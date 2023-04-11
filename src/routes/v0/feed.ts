import { Post, Comment } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

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
				take: 10,
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
				take: 10,
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
		const len = posts.length;
		if (len > 0 && len === 10) {
			newCursor = posts[len - 1].id;
		}

		const mappedPosts = posts.map(post =>
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

		await prisma.friendship.update({
			where: {
				id: friendship.id,
			},
			data: {
				lastReadPostTime: new Date(),
			},
		});
		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

export default router;
