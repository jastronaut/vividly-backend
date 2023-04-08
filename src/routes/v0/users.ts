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
			return res.status(400).json({ error: 'Invalid username' });
		}

		try {
			const user = await prisma.user.findUnique({
				where: {
					username,
				},
			});

			if (user) {
				return res.status(200).json({ exists: true });
			}

			return res.status(200).json({ exists: false });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: 'Internal server error' });
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
		return res.status(400).json({ error: 'Invalid username' });
	}

	try {
		const usernameUser = await prisma.user.findUnique({
			where: {
				username,
			},
		});

		if (usernameUser) {
			return res.status(400).json({ error: 'Username taken' });
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
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route GET /v0/users/email/exists/:email
// @desc Check if email exists
// @access Public
router.get('/email/exists/:email', async (req: Request, res: Response) => {
	const { email } = req.params;

	if (!validateEmail(email)) {
		return res.status(400).json({ error: 'Invalid email' });
	}

	try {
		const user = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (user) {
			return res.status(200).json({ exists: true });
		}

		return res.status(200).json({ exists: false });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route POST /v0/users/name/change
// @desc Change name
// @access Private
router.post('/name/change', auth, async (req: Request, res: Response) => {
	const { name } = req.body;
	const user = req.user as RequestUser;

	if (!validateName(name)) {
		return res.status(400).json({ error: 'Invalid name' });
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
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route POST /v0/users/email/change
// @desc Change email and send verification email
// @access Private
router.post('/email/change', auth, async (req: Request, res: Response) => {
	const { email } = req.body;
	const user = req.user as RequestUser;

	if (!validateEmail(email)) {
		return res.status(400).json({ error: 'Invalid email' });
	}

	try {
		const emailUser = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (emailUser) {
			return res.status(400).json({ error: 'Email taken' });
		}

		const code = generateVerificationCode();

		await prisma.authUser.update({
			where: {
				userId: user.id,
			},
			data: {
				email,
				emailVerified: false,
				verificationCode: code,
			},
		});

		const message = {
			from: { email: 'notify@vividly.love', name: 'Vividly' },
			to: { email: email, name: user.name },
			subject: 'Verify your email',
			html: `<p>Click <a href="http://localhost:3000/verify/${user.id}/${code}">here</a> to verify your email</p>`,
			templateId: 'd-54260593ff0c4e6aa1503828726ddff2',
			dynamicTemplateData: {
				username: '@' + user.username,
				first_name: '@' + user.username,
				verify_url: `http://localhost:3000/verify/${user.id}/${code}`,
			},
		};

		await SendGrid.send(message);

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route GET /v0/users/:id
// @desc Get user by id
// @access Public
router.get('/:id', auth, async (req: Request, res: Response) => {
	const { id } = req.params;
	const user = req.user as RequestUser;

	try {
		const userResult = await prisma.user.findUnique({
			where: {
				id,
			},
		});

		if (!userResult) {
			return res.status(404).json({ error: 'User not found' });
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
			return res.status(404).json({ error: 'User not found' });
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
						fromUserId: true,
						toUserId: true,
					},
				});
			}
		}

		return res.status(200).json({
			user: {
				id: userResult.id,
				username: userResult.username,
				name: userResult.name,
				bio: userResult.bio,
				avatarSrc: userResult.avatarSrc,
			},
			isBlocked: !!userBlockedUsers,
			friendship,
			friendRequest,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
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
			return res.status(400).json({ error: 'Invalid avatar' });
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
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route POST /v0/users/info/change
// @desc Change basic user info (bio, name, avatar)
// @access Private
router.post('/info/change', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const { bio, name, avatarSrc } = req.body;

	try {
		if (!validateImgSrc(avatarSrc)) {
			return res.status(400).json({ error: 'Invalid avatar' });
		}

		if (!validateName(name)) {
			return res.status(400).json({ error: 'Invalid name' });
		}

		if (!validateBio(bio)) {
			return res.status(400).json({ error: 'Invalid bio' });
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				bio,
				name,
				avatarSrc,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;
