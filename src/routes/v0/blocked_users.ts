import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

// @route  GET /v0/blocked_users
// @desc   Get all blocked users
// @access Private
router.get('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const blockedUsers = await prisma.blockedUser.findMany({
			where: {
				blockerId: user.id,
			},
		});

		res.status(200).json(blockedUsers);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route  POST /v0/blocked_users/block/:userid
// @desc   Block a user
// @access Private
router.post('/block/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { userid } = req.params;

		const otherUser = await prisma.user.findUnique({
			where: {
				id: userid,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		// check if user is already blocked
		const isUserBlocked = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: user.id,
				blockerId: userid,
			},
		});

		if (isUserBlocked) {
			return res
				.status(403)
				.json({ success: true, error: 'User is already blocked' });
		}

		// check if user is already a friend
		const isUserFriend = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: userid,
			},
		});

		await prisma.friendship.deleteMany({
			where: {
				userId: user.id,
				friendId: userid,
			},
		});

		await prisma.friendship.deleteMany({
			where: {
				userId: userid,
				friendId: user.id,
			},
		});

		await prisma.blockedUser.create({
			data: {
				blockedUser: {
					connect: {
						id: userid,
					},
				},
				blocker: {
					connect: {
						id: user.id,
					},
				},
			},
		});

		if (isUserFriend) {
			// remove all comments from blocked user on user's posts
			await prisma.comment.deleteMany({
				where: {
					authorId: userid,
					post: {
						authorId: user.id,
					},
				},
			});

			await prisma.comment.deleteMany({
				where: {
					authorId: user.id,
					post: {
						authorId: userid,
					},
				},
			});
		}

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route  POST /v0/blocked_users/unblock/:userid
// @desc   Unblock a user
// @access Private
router.post('/unblock/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { userid } = req.params;

		const otherUser = await prisma.user.findUnique({
			where: {
				id: userid,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ error: 'User not found' });
		}

		// check if user is already blocked
		const isUserBlocked = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: user.id,
				blockerId: userid,
			},
		});

		if (!isUserBlocked) {
			return res.status(403).json({ error: 'User is not blocked' });
		}

		const blockedUser = await prisma.blockedUser.delete({
			where: {
				id: isUserBlocked.id,
			},
		});

		res.status(200).json(blockedUser);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

export default router;
