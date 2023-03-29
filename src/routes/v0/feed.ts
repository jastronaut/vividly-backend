import { Post, PrismaClient, Comment } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

function createFeedResponseForPostandUserId(
	post: Post & { comments: Comment[] },
	userId: string
) {
	const likedByUser = post.likedByIds.find(like => like === userId);
	return {
		id: post.id,
		createdTime: post.createdTime,
		commentsDisabled: post.commentsDisabled,
		authorId: post.authorId,
		content: post.content,
		likes: post.likedByIds.length,
		isLikedByUser: likedByUser ? true : false,
		comments: post.comments,
	};
}

// @route  GET /v0/feed/uid/:userid
// @desc   Get feed for a user
// @access Private
router.get('/uid/:userid', auth, async (req: Request, res: Response) => {
	let cursor = req.query.cursor as string;
	const user = req.user as RequestUser;
	const { userid } = req.params;

	try {
		const otherUser = await prisma.user.findUnique({
			where: {
				id: userid,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ error: 'User not found' });
		}

		if (userid !== user.id) {
			const friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userid,
				},
			});

			if (!friendship) {
				return res.status(403).json({ error: 'Cannot view feed' });
			}
		}

		// get posts
		let posts = [];
		if (cursor) {
			posts = await prisma.post.findMany({
				where: {
					authorId: userid,
					createdTime: {
						lt: cursor,
					},
				},
				take: 10,
				orderBy: {
					createdTime: 'desc',
				},
				include: {
					comments: true,
				},
			});
		} else {
			posts = await prisma.post.findMany({
				where: {
					authorId: userid,
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

		res
			.status(200)
			.json(
				posts.map(post => createFeedResponseForPostandUserId(post, user.id))
			);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

// @route POST /v0/feed/uid/:userid/read
// @desc Mark feed as read
// @access Private
router.post('/uid/:userid/read', auth, async (req: Request, res: Response) => {
	const { userid } = req.params;
	const user = req.user as RequestUser;

	try {
		const otherUser = await prisma.user.findUnique({
			where: {
				id: userid,
			},
		});

		if (!otherUser) {
			return res.status(404).json({ error: 'User not found' });
		}

		const friendship = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: userid,
			},
		});

		if (!friendship) {
			return res.status(403).json({ error: 'Cannot mark feed as read' });
		}

		await prisma.friendship.update({
			where: {
				id: friendship.id,
			},
			data: {
				lastReadPostTime: new Date(),
			},
		});
		res.status(200).json({ message: 'Marked feed as read' });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});

export default router;
