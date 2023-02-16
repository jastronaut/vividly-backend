import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// @route  GET /v0/friends
// @desc   Get all friends
// @access Private
router.get('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const friends = await prisma.friendship.findMany({
			where: {
				userId: user.id,
			},
		});

		res.status(200).json(friends);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route  POST /v0/friends/add/:userid
// @desc   Add a friend
// @access Private
router.post('/add/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { uid } = req.params;

		const otherUser = await prisma.user.findUnique({
			where: {
				id: uid,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ error: 'User not found' });
		}

		// check if user is blocked by other user
		const isUser1BlockedByUser2 = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: user.id,
				blockerId: uid,
			},
		});

		if (isUser1BlockedByUser2) {
			return res
				.status(403)
				.json({ error: 'Cannot send friend request to user' });
		}

		const ifUser2BlockedUser1 = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: uid,
				blockerId: user.id,
			},
		});

		if (ifUser2BlockedUser1) {
			return res
				.status(403)
				.json({ error: 'Cannot send friend request to user' });
		}

		const friend = await prisma.friendRequest.create({
			data: {
				fromUserId: user.id,
				toUserId: uid,
				createdTime: new Date(),
			},
		});

		res.status(200).json(friend);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route POST /v0/friends/accept/:userid
// @desc Accept a friend request
// @access Private
router.post('/accept/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { uid } = req.params;

		const friendRequest = await prisma.friendRequest.findFirst({
			where: {
				fromUserId: uid,
				toUserId: user.id,
			},
		});

		if (!friendRequest) {
			return res.status(404).json({ error: 'Friend request not found' });
		}

		const friend = await prisma.friendship.create({
			data: {
				userId: user.id,
				friendId: uid,
				lastReadPostTime: new Date(),
			},
		});

		// delete friend request
		await prisma.friendRequest.delete({
			where: {
				id: friendRequest.id,
			},
		});

		res.status(200).json(friend);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route POST /v0/friends/reject/:userid
// @desc Reject a friend request
// @access Private
router.post('/reject/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { uid } = req.params;

		const friendRequest = await prisma.friendRequest.findFirst({
			where: {
				fromUserId: uid,
				toUserId: user.id,
			},
		});

		if (!friendRequest) {
			return res.status(404).json({ error: 'Friend request not found' });
		}

		// delete friend request
		await prisma.friendRequest.delete({
			where: {
				id: friendRequest.id,
			},
		});

		res.status(200).json({ message: 'Friend request rejected' });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route POST /v0/friends/rescind/:userid
// @desc Rescind a friend request
// @access Private
router.post('/rescind/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { uid } = req.params;

		const friendRequest = await prisma.friendRequest.findFirst({
			where: {
				fromUserId: user.id,
				toUserId: uid,
			},
		});

		if (!friendRequest) {
			return res.status(404).json({ error: 'Friend request not found' });
		}

		// delete friend request
		await prisma.friendRequest.delete({
			where: {
				id: friendRequest.id,
			},
		});

		res.status(200).json({ message: 'Friend request rescinded' });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route POST /v0/friends/unfriend/:userid
// @desc Unfriend a friend
// @access Private
router.post('/unfriend/:userid', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { uid } = req.params;

		const friendship = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: uid,
			},
		});

		if (!friendship) {
			return res.status(404).json({ error: 'Friend not found' });
		}

		// delete friendship
		await prisma.friendship.delete({
			where: {
				id: friendship.id,
			},
		});

		res.status(200).json({ message: 'Friendship ended' });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route GET /v0/friends/requests
// @desc Get all friend requests
// @access Private
router.get('/requests', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const friendRequests = await prisma.friendRequest.findMany({
			where: {
				toUserId: user.id,
			},
			include: {
				fromUser: true,
			},
		});

		res.status(200).json(friendRequests);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});
