import { Request, Response } from 'express';
import express from 'express';

import { FriendRequest, User } from '@prisma/client';
import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth, verifyEmail } from '../../middleware/auth';

const MAX_FRIENDS = 500;

const router = express.Router();

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
			select: {
				id: true,
				isFavorite: true,
				lastReadPostId: true,
				lastReadPostTime: true,
				friend: {
					select: {
						id: true,
						username: true,
						avatarSrc: true,
						bio: true,
						name: true,
					},
				},
			},
		});

		res.status(200).json({ friends: friends, success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route  POST /v0/friends/add/:username
// @desc   Add a friend by username
// @access Private
router.post('/add/:username', [auth], async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { username } = req.params;

		// make sure we are under the max friends limit
		const numFriends = user.friends.length;

		if (numFriends >= MAX_FRIENDS) {
			return res.status(403).json({
				success: false,
				error: `Cannot add more than ${MAX_FRIENDS} friends`,
			});
		}

		if (username === user.username) {
			return res
				.status(403)
				.json({ success: false, error: 'Cannot add self as friend' });
		}

		const otherUser = await prisma.user.findUnique({
			where: {
				username: username,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		// check if user is blocked by other user
		const isUser1BlockedByUser2 = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: user.id,
				blockerId: otherUser.id,
			},
		});

		if (isUser1BlockedByUser2) {
			return res
				.status(403)
				.json({ success: true, error: 'Cannot send friend request to user' });
		}

		const ifUser2BlockedUser1 = await prisma.blockedUser.findFirst({
			where: {
				blockedUserId: otherUser.id,
				blockerId: user.id,
			},
		});

		if (ifUser2BlockedUser1) {
			return res
				.status(403)
				.json({ success: true, error: 'Cannot send friend request to user' });
		}

		// check if user is already friends with other user
		const isUser1FriendsWithUser2 = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: otherUser.id,
			},
		});

		if (isUser1FriendsWithUser2) {
			return res
				.status(403)
				.json({ success: true, error: 'Already friends with user' });
		}

		// check if user has already sent a friend request to other user
		const hasUser1SentFriendRequestToUser2 =
			await prisma.friendRequest.findFirst({
				where: {
					fromUserId: user.id,
					toUserId: otherUser.id,
				},
			});

		if (hasUser1SentFriendRequestToUser2) {
			return res.status(403).json({
				success: true,
				error: 'Already sent friend request to user',
			});
		}

		const request = await prisma.friendRequest.create({
			data: {
				fromUserId: user.id,
				toUserId: otherUser.id,
				createdTime: new Date(),
			},
			include: {
				toUser: true,
			},
		});

		res.status(200).json({
			friendRequest: {
				id: request.id,
				createdTime: request.createdTime,
				user: request.toUser,
			},
			success: true,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route POST /v0/friends/requests/accept/:id
// @desc Accept a friend request
// @access Private
router.post(
	'/requests/accept/:id',
	[auth, verifyEmail],
	async (req: Request, res: Response) => {
		try {
			const user = req.user as RequestUser;
			const id = parseInt(req.params.id);

			// make sure we are under the max friends limit
			const numFriends = user.friends.length;

			if (numFriends >= MAX_FRIENDS) {
				return res.status(403).json({
					success: false,
					error: `Cannot add more than ${MAX_FRIENDS} friends`,
				});
			}

			const friendRequest = await prisma.friendRequest.findFirst({
				where: {
					id: id,
				},
				select: {
					id: true,
					fromUserId: true,
					fromUser: {
						select: {
							id: true,
							username: true,
							avatarSrc: true,
							bio: true,
							name: true,
						},
					},
				},
			});

			if (!friendRequest) {
				return res
					.status(404)
					.json({ success: false, error: 'Friend request not found' });
			}

			const friendToUser = await prisma.friendship.create({
				data: {
					userId: user.id,
					friendId: friendRequest.fromUserId,
					lastReadPostTime: new Date(),
					friendType: 'FRIEND',
				},
			});

			const userToFriend = await prisma.friendship.create({
				data: {
					userId: friendRequest.fromUserId,
					friendId: user.id,
					lastReadPostTime: new Date(),
					friendType: 'FRIEND',
				},
			});

			if (!friendToUser || !userToFriend) {
				return res.status(500).json({ success: false, error: 'Server error' });
			}

			const friendshipResponse = {
				id: friendToUser.id,
				isFavorite: friendToUser.isFavorite,
				lastReadPostTime: friendToUser.lastReadPostTime,
				friendType: friendToUser.friendType,
				friend: friendRequest.fromUser,
			};

			// delete friend request
			await prisma.friendRequest.delete({
				where: {
					id: friendRequest.id,
				},
			});

			res.status(200).json({ friendship: friendshipResponse, success: true });
		} catch (error) {
			console.error(error);
			res.status(500).json({ success: false, error: 'Server error' });
		}
	}
);

// @route POST /v0/friends/requests/reject/:id
// @desc Reject a friend request
// @access Private
router.post(
	'/requests/reject/:id',
	auth,
	async (req: Request, res: Response) => {
		try {
			const id = parseInt(req.params.id);

			const friendRequest = await prisma.friendRequest.findFirst({
				where: {
					id,
				},
			});

			if (!friendRequest) {
				return res
					.status(404)
					.json({ success: false, error: 'Friend request not found' });
			}

			// delete friend request
			await prisma.friendRequest.delete({
				where: {
					id: friendRequest.id,
				},
			});

			res.status(200).json({ success: true });
		} catch (error) {
			console.error(error);
			res.status(500).json({ success: false, error: 'Server error' });
		}
	}
);

// @route POST /v0/friends/requests/cancel/:id
// @desc Cancel a friend request
// @access Private
router.post(
	'/requests/cancel/:id',
	auth,
	async (req: Request, res: Response) => {
		try {
			const id = parseInt(req.params.id);

			const friendRequest = await prisma.friendRequest.findFirst({
				where: {
					id,
				},
			});

			if (!friendRequest) {
				return res
					.status(404)
					.json({ success: false, error: 'Friend request not found' });
			}

			// delete friend request
			await prisma.friendRequest.delete({
				where: {
					id: friendRequest.id,
				},
			});

			res.status(200).json({ success: true });
		} catch (error) {
			console.error(error);
			res.status(500).json({ success: false, error: 'Server error' });
		}
	}
);

// @route POST /v0/friends/unfriend/:userId
// @desc Unfriend a friend
// @access Private
router.post('/unfriend/:userId', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const userId = parseInt(req.params.userId);

		const friendshipForUser = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: userId,
			},
		});

		const friendshipToUser = await prisma.friendship.findFirst({
			where: {
				userId: userId,
				friendId: user.id,
			},
		});

		if (!friendshipForUser || !friendshipToUser) {
			return res
				.status(404)
				.json({ success: false, error: 'Friend not found' });
		}

		// delete friendship
		await prisma.friendship.deleteMany({
			where: {
				OR: [
					{
						id: friendshipToUser.id,
					},
					{
						id: friendshipForUser.id,
					},
				],
			},
		});

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

type FriendRequestWithUser = FriendRequest & {
	fromUser?: User | null;
	toUser?: User | null;
};

function formatFriendRequestsResponse(friendRequests: FriendRequestWithUser[]) {
	return friendRequests.map(friendRequest => {
		const user = friendRequest.fromUser || friendRequest.toUser;
		return {
			id: friendRequest.id,
			user: {
				id: user?.id,
				username: user?.username,
				avatarSrc: user?.avatarSrc,
				name: user?.name,
				bio: user?.bio,
			},
			createdTime: friendRequest.createdTime,
		};
	});
}

// @route GET /v0/friends/requests
// @desc Get all friend requests
// @access Private
router.get('/requests', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const inboundRequests = await prisma.friendRequest.findMany({
			where: {
				toUserId: user.id,
			},
			include: {
				fromUser: true,
			},
		});

		const outboundRequests = await prisma.friendRequest.findMany({
			where: {
				fromUserId: user.id,
			},
			include: {
				toUser: true,
			},
		});

		res.status(200).json({
			success: true,
			inbound: formatFriendRequestsResponse(inboundRequests),
			outbound: formatFriendRequestsResponse(outboundRequests),
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route POST /v0/friends/favorite/:userId
// @desc Favorite a friend
// @access Private
router.post(
	'/favorite/:userId',
	[auth, verifyEmail],
	async (req: Request, res: Response) => {
		try {
			const user = req.user as RequestUser;
			const userId = parseInt(req.params.userId);

			const friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userId,
				},
			});

			if (!friendship) {
				return res
					.status(404)
					.json({ success: false, error: 'Friend not found' });
			}

			const updatedFriendship = await prisma.friendship.update({
				where: {
					id: friendship.id,
				},
				data: {
					isFavorite: true,
				},
			});

			res.status(200).json({ friendship: updatedFriendship, success: true });
		} catch (error) {
			console.error(error);
			res.status(500).json({ success: false, error: 'Server error' });
		}
	}
);

// @route POST /v0/friends/unfavorite/:userId
// @desc Unfavorite a friend
// @access Private
router.post(
	'/unfavorite/:userId',
	[auth, verifyEmail],
	async (req: Request, res: Response) => {
		try {
			const user = req.user as RequestUser;
			const userId = parseInt(req.params.userId);

			const friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userId,
				},
			});

			if (!friendship) {
				return res
					.status(404)
					.json({ success: false, error: 'Friend not found' });
			}

			const updatedFriendship = await prisma.friendship.update({
				where: {
					id: friendship.id,
				},
				data: {
					isFavorite: false,
				},
			});

			res.status(200).json({ friendship: updatedFriendship, success: true });
		} catch (error) {
			console.error(error);
			res.status(500).json({ success: false, error: 'Server error' });
		}
	}
);

export default router;
