import { Post, Comment } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

const PROFILE_FEED_LENGTH = 10;

type CommentWithAuthor = Comment & {
	author: { id: number; username: string; name: string; avatarSrc: string };
};

function createFeedResponseForPostandUserId(
	post: Post & { comments: CommentWithAuthor[] },
	userId: number,
	blockedUserIds: number[]
) {
	const likedByUser = post.likedByIds.find(like => like === userId);
	// can we do this with prisma?
	const filteredComments = post.comments.filter(
		comment => !blockedUserIds.includes(comment.authorId)
	);
	return {
		id: post.id,
		createdTime: post.createdTime,
		commentsDisabled: post.commentsDisabled,
		authorId: post.authorId,
		content: post.content,
		likes: post.likedByIds.length,
		isLikedByUser: likedByUser ? true : false,
		comments: filteredComments,
	};
}

// @route  GET /v0/feed/uid/:userId
// @desc   Get feed for a user
// @access Private
router.get('/uid/:userId', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const userId = parseInt(req.params.userId);
	const cursor = parseInt(req.query.cursor as string);

	try {
		const otherUser = await prisma.user.findUnique({
			where: {
				id: userId,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		if (userId !== user.id) {
			const friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userId,
				},
			});

			if (!friendship) {
				return res
					.status(403)
					.json({ success: false, error: 'Cannot view feed' });
			}
		}

		// get posts
		let posts = [];
		if (cursor) {
			posts = await prisma.post.findMany({
				cursor: {
					id: cursor,
				},
				where: {
					authorId: userId,
				},
				take: PROFILE_FEED_LENGTH + 1,
				skip: 1,
				orderBy: {
					createdTime: 'desc',
				},
				include: {
					comments: {
						include: {
							author: {
								select: {
									id: true,
									name: true,
									username: true,
									avatarSrc: true,
								},
							},
						},
					},
				},
			});
		} else {
			posts = await prisma.post.findMany({
				where: {
					authorId: userId,
				},
				take: PROFILE_FEED_LENGTH + 1,
				orderBy: {
					createdTime: 'desc',
				},
				include: {
					comments: {
						include: {
							author: {
								select: {
									id: true,
									name: true,
									username: true,
									avatarSrc: true,
								},
							},
						},
					},
				},
			});
		}

		// get users blocked by request user
		const blockedUsers = await prisma.blockedUser.findMany({
			select: {
				blockedUserId: true,
			},
			where: {
				blockerId: user.id,
			},
		});

		let newCursor: number | null = null;
		// we need to check if there are more posts
		const len = posts.length;
		if (len > PROFILE_FEED_LENGTH) {
			newCursor = posts[len - 2].id;
		}

		const mappedPosts = posts.slice(0, 10).map(post =>
			createFeedResponseForPostandUserId(
				post,
				user.id,
				blockedUsers.map(user => user.blockedUserId)
			)
		);

		res
			.status(200)
			.json({ success: true, data: mappedPosts, cursor: newCursor });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route POST /v0/feed/uid/:userId/read
// @desc Mark feed as read
// @access Private
router.post('/uid/:userId/read', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const userId = parseInt(req.params.userId);

	try {
		const otherUser = await prisma.user.findUnique({
			where: {
				id: userId,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		const friendship = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: userId,
			},
		});

		if (!friendship) {
			return res
				.status(403)
				.json({ success: false, error: 'Cannot mark feed as read' });
		}

		// get id of latest post
		const latestPost = await prisma.post.findFirst({
			where: {
				authorId: userId,
			},
			orderBy: {
				createdTime: 'desc',
			},
		});

		await prisma.friendship.update({
			where: {
				id: friendship.id,
			},
			data: {
				lastReadPostTime: new Date(),
				lastReadPostId: latestPost?.id,
			},
		});
		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

// @route  GET /v0/feed/friends
// @desc   Get feed for all friends
// @access Private
router.get('/friends', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;

	try {
		const friendships = await prisma.friendship.findMany({
			where: {
				userId: user.id,
			},
			select: {
				isFavorite: true,
				lastReadPostId: true,
				lastReadPostTime: true,
				friend: {
					select: {
						id: true,
						name: true,
						username: true,
						avatarSrc: true,
						posts: {
							take: 1,
							orderBy: {
								createdTime: 'desc',
							},
							select: {
								id: true,
								createdTime: true,
								content: true,
							},
						},
					},
				},
			},
		});

		res.status(200).json({ success: true, data: friendships });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

export default router;
