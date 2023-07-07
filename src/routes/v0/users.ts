import { Request, Response } from 'express';
import express from 'express';
import SendGrid from '@sendgrid/mail';
SendGrid.setApiKey(process.env.SENDGRID_API_KEY || '');

import { prisma } from '../../app';
import { auth } from '../../middleware/auth';
import {
	validateEmail,
	validateUsername,
	validateName,
	generateVerificationCode,
	validateImgSrc,
	validateBio,
} from '../../utils';
import { RequestUser } from '../../types/types';

const router = express.Router();

// @route GET /v0/users/username/exists/:username
// @desc Check if username exists
// @access Public
router.get(
	'/username/exists/:username',
	async (req: Request, res: Response) => {
		const { username } = req.params;

		if (!validateUsername(username)) {
			return res
				.status(400)
				.json({ success: false, error: 'Invalid username' });
		}

		try {
			const user = await prisma.user.findUnique({
				where: {
					username,
				},
			});

			if (user) {
				return res.status(200).json({ sucess: true, exists: true });
			}

			return res.status(200).json({ success: true, exists: false });
		} catch (err) {
			console.error(err);
			return res
				.status(500)
				.json({ success: false, error: 'Internal server error' });
		}
	}
);

// @route POST /v0/users/username/change
// @desc Change username
// @access Private
router.post('/username/change', auth, async (req: Request, res: Response) => {
	const { username } = req.body;
	const user = req.user as RequestUser;

	if (!validateUsername(username)) {
		return res.status(400).json({ success: false, error: 'USERNAME_INVALID' });
	}

	try {
		const usernameUser = await prisma.user.findUnique({
			where: {
				username,
			},
		});

		if (usernameUser) {
			return res.status(400).json({
				success: false,
				error: 'Username taken',
				errorCode: 'USERNAME_TAKEN',
			});
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},

			data: {
				username,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

// @route GET /v0/users/email/exists/:email
// @desc Check if email exists
// @access Public
router.get('/email/exists/:email', async (req: Request, res: Response) => {
	const { email } = req.params;

	if (!validateEmail(email)) {
		return res.status(400).json({ success: false, error: 'Invalid email' });
	}

	try {
		const user = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (user) {
			return res.status(200).json({ success: true, exists: true });
		}

		return res.status(200).json({ success: true, exists: false });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

// @route POST /v0/users/name/change
// @desc Change name
// @access Private
router.post('/name/change', auth, async (req: Request, res: Response) => {
	const { name } = req.body;
	const user = req.user as RequestUser;

	if (!validateName(name)) {
		return res.status(400).json({ success: false, error: 'Invalid name' });
	}

	try {
		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				name,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

// @route GET /v0/users/:id
// @desc Get user by id
// @access Public
router.get('/:id', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const id = parseInt(req.params.id);

	try {
		const userResult = await prisma.user.findUnique({
			where: {
				id,
			},
		});

		if (!userResult) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		// get users blocked by result user
		const userResultBlockedUsers = await prisma.blockedUser.findFirst({
			select: {
				blockedUserId: true,
			},
			where: {
				blockerId: userResult.id,
				blockedUserId: user.id,
			},
		});

		if (userResultBlockedUsers) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		// get users blocked by requesting user
		const userBlockedUsers = await prisma.blockedUser.findFirst({
			select: {
				blockedUserId: true,
			},
			where: {
				blockerId: user.id,
				blockedUserId: userResult.id,
			},
		});

		let friendship = null;
		let friendRequest = null;

		if (!userBlockedUsers) {
			// get friendship
			friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userResult.id,
				},
				select: {
					id: true,
					isFavorite: true,
					lastReadPostId: true,
					lastReadPostTime: true,
				},
			});

			if (!friendship) {
				friendRequest = await prisma.friendRequest.findFirst({
					where: {
						OR: [
							{
								fromUserId: user.id,
								toUserId: userResult.id,
							},
							{
								fromUserId: userResult.id,
								toUserId: user.id,
							},
						],
					},
					select: {
						id: true,
						fromUserId: true,
						toUserId: true,
					},
				});
			}
		}

		// get ID of newest post
		const newestPost = await prisma.post.findFirst({
			where: {
				authorId: userResult.id,
			},
			orderBy: {
				createdTime: 'desc',
			},
			select: {
				id: true,
			},
		});

		return res.status(200).json({
			success: true,
			user: {
				id: userResult.id,
				username: userResult.username,
				name: userResult.name,
				bio: userResult.bio,
				avatarSrc: userResult.avatarSrc,
			},
			isBlocked: !!userBlockedUsers,
			friendship: friendship
				? {
						...friendship,
						newestPostId: newestPost?.id,
				  }
				: null,
			friendRequest,
		});
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

// @route POST /v0/users/avatar/change
// @desc Change avatar
// @access Private
router.post('/avatar/change', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const { avatarSrc } = req.body;

	try {
		if (!validateImgSrc(avatarSrc)) {
			return res.status(400).json({ success: false, error: 'Invalid avatar' });
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				avatarSrc,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

// @route POST /v0/users/info/change
// @desc Change basic user info (bio, name, avatar)
// @access Private
router.post('/info/change', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const { bio = null, name = null, avatarSrc = null } = req.body;

	if (!bio && !name && !avatarSrc) {
		return res.status(400).json({
			success: false,
			error: 'No data provided',
			errorCode: 'USER_INFO_INVALID',
		});
	}

	try {
		if (avatarSrc && !validateImgSrc(avatarSrc)) {
			return res
				.status(400)
				.json({ success: false, error: 'USER_INFO_AVATAR_INVALID' });
		}

		if (name && !validateName(name)) {
			return res
				.status(400)
				.json({ success: false, error: 'USER_INFO_NAME_INVALID' });
		}

		if (bio && !validateBio(bio)) {
			return res
				.status(400)
				.json({ success: false, error: 'USER_INFO_BIO_INVALID' });
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				bio: bio === null ? user.bio : bio,
				name: name === null ? user.name : name,
				avatarSrc: avatarSrc === null ? user.avatarSrc : avatarSrc,
			},
		});

		const updatedUser = {
			id: user.id,
			bio: user.bio,
			name: user.name,
			avatarSrc: user.avatarSrc,
			username: user.username,
		};

		return res.status(200).json({
			success: true,
			user: updatedUser,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({
			success: false,
			error: 'Internal server error',
			errorCode: 'USER_INFO_CHANGE_FAILED',
		});
	}
});

// @route GET /v0/users/info/me
// @desc Get current user
// @access Private
router.get('/info/me', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;

	try {
		const userResult = await prisma.user.findUnique({
			where: {
				id: user.id,
			},
			select: {
				id: true,
				username: true,
				name: true,
				bio: true,
				avatarSrc: true,
			},
		});

		if (!userResult) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		return res.status(200).json({ success: true, user: userResult });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ success: false, error: 'Internal server error' });
	}
});

export default router;
