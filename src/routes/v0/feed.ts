import { Post, Comment } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

type CommentWithAuthor = Comment & {
	author: { id: string; username: string; name: string; avatarSrc: string };
};

function createFeedResponseForPostandUserId(
	post: Post & { comments: CommentWithAuthor[] },
	userId: string,
	blockedUserIds: string[]
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
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		if (userid !== user.id) {
			const friendship = await prisma.friendship.findFirst({
				where: {
					userId: user.id,
					friendId: userid,
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
					authorId: userid,
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

		// get users blocked by request user
		const blockedUsers = await prisma.blockedUser.findMany({
			select: {
				blockedUserId: true,
			},
			where: {
				blockerId: user.id,
			},
		});

		let newCursor: string | null = null;
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
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		const friendship = await prisma.friendship.findFirst({
			where: {
				userId: user.id,
				friendId: userid,
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
