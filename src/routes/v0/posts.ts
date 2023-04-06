import { Comment, Post, CommentReply } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';
import { postMiddleware } from '../../middleware/post';

const router = express.Router();

const MAX_POST_BLOCKS = 50;
const MAX_COMMENT_LENGTH = 500;

async function canUserViewPost(user: RequestUser, post: Post) {
	const authorId = post.authorId;
	if (authorId === user.id) {
		return true;
	}

	const friendship1 = await prisma.friendship.findFirst({
		where: {
			userId: user.id,
			friendId: authorId,
		},
	});

	const friendship2 = await prisma.friendship.findFirst({
		where: {
			userId: authorId,
			friendId: user.id,
		},
	});

	if (friendship1 !== null && friendship2 !== null) {
		return true;
	}

	// get users blocked by request user
	const blockedUsers = await prisma.blockedUser.findMany({
		select: {
			blockedUserId: true,
		},
		where: {
			blockerId: post.authorId,
		},
	});

	const blockedUserIds = blockedUsers.map(user => user.blockedUserId);

	if (blockedUserIds.includes(user.id)) {
		return false;
	}

	return false;
}

async function canUserCommentOnPost(user: RequestUser, post: Post) {
	if (post.authorId === user.id) {
		return true;
	}

	const canView = await canUserViewPost(user, post);
	if (!canView) {
		return false;
	}

	if (post.commentsDisabled) {
		return false;
	}

	return true;
}

async function createPostResponseForUserId(userId: string, post: Post) {
	const likesLen = post.likedByIds.length;
	const likedByUser = post.likedByIds.find(id => id === userId) !== undefined;

	// get author
	const author = await prisma.user.findUnique({
		where: {
			id: post.authorId,
		},
	});

	if (!author) {
		throw new Error('Author not found');
	}

	// get comments
	const comments = await prisma.comment.findMany({
		where: {
			postId: post.id,
		},
		orderBy: {
			createdTime: 'desc',
		},
		select: {
			id: true,
			authorId: true,
			content: true,
		},
	});

	return {
		id: post.id,
		createdTime: post.createdTime,
		commentsDisabled: post.commentsDisabled,
		authorId: post.authorId,
		content: post.content,
		likes: likesLen,
		likedByUser,
		comments,
		author: {
			id: author.id,
			name: author.name,
			username: author.username,
			avatarSrc: author.avatarSrc,
		},
	};
}

async function createCommentReplyResponse(
	commentReply: CommentReply,
	author?: RequestUser
) {
	let replyAuthor = null;

	if (author) {
		replyAuthor = author;
	} else if (!replyAuthor) {
		const replyAuthorSearch = await prisma.user.findUnique({
			where: {
				id: commentReply.authorId,
			},
		});

		if (!replyAuthorSearch) {
			throw new Error('Reply author not found');
		}

		replyAuthor = {
			id: replyAuthorSearch.id,
			name: replyAuthorSearch.name,
			username: replyAuthorSearch.username,
			avatarSrc: replyAuthorSearch.avatarSrc,
		};
	}

	return {
		...commentReply,
		author: replyAuthor,
	};
}

// @route GET v0/posts
// @desc Get Post by ID
// @access Public
router.get(
	'/:id',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { post, user } = req;
		try {
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			const canView = await canUserViewPost(user, post);
			if (!canView) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot view this post' });
			}

			const postResponse = await createPostResponseForUserId(user.id, post);
			res.status(200).json({ success: true, post: postResponse });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts/id/like
// @desc Like a post
// @access Private
router.post('/:id/like', auth, async (req: Request, res: Response) => {
	const { id } = req.params;
	const { user } = req;
	try {
		const post = await prisma.post.findUnique({
			where: {
				id,
			},
		});

		if (!post || !user) {
			return res.status(404).json({ success: false, msg: 'Post not found' });
		}

		if (!canUserViewPost(user, post)) {
			return res
				.status(403)
				.json({ success: false, msg: 'You cannot view this post' });
		}

		const liked = post.likedByIds.find(userId => userId === user.id);

		if (liked) {
			return res
				.status(400)
				.json({ success: false, msg: 'You already liked this post' });
		}

		await prisma.post.update({
			where: {
				id,
			},
			data: {
				likedByIds: {
					push: user.id,
				},
			},
		});

		res.status(200).json({ success: true, likes: post.likedByIds.length + 1 });
	} catch (err) {
		res.status(500).json({ success: false, error: err });
	}
});

// @route POST v0/posts/id/unlike
// @desc Unlike a post
// @access Private
router.post(
	'/:id/unlike',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { id } = req.params;
		const { user, post } = req;
		try {
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (!canUserViewPost(user, post)) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot view this post' });
			}

			const liked = post.likedByIds.find(userId => userId === user.id);

			if (!liked) {
				return res
					.status(400)
					.json({ success: false, msg: 'You have not liked this post' });
			}

			await prisma.post.update({
				where: {
					id,
				},
				data: {
					likedByIds: post.likedByIds.filter(userId => userId !== user.id),
				},
			});

			res
				.status(200)
				.json({ success: true, likes: post.likedByIds.length - 1 });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts
// @desc Create a post
// @access Private
router.post('/', auth, async (req: Request, res: Response) => {
	const { user } = req;

	if (!user) {
		return res.status(401).json({ success: false, msg: 'Unauthorized' });
	}

	try {
		const { content } = req.body;
		if (!content) {
			return res.status(400).json({ success: false, msg: 'Invalid post' });
		}

		const contentLength = content.length;

		if (contentLength === 0) {
			return res.status(400).json({ success: false, msg: 'Invalid post' });
		}

		// this isn't implemented in the frontend yet
		if (contentLength > MAX_POST_BLOCKS) {
			return res.status(400).json({ success: false, msg: 'Post is too long' });
		}

		const post = await prisma.post.create({
			data: {
				content,
				authorId: user.id,
				createdTime: new Date(),
				updatedTime: new Date(),
			},
		});

		const postResponse = await createPostResponseForUserId(user.id, post);

		res.status(200).json({ success: true, post: postResponse });
	} catch (err) {
		console.log(err);
		res.status(500).json({ success: false, error: err });
	}
});

// @route DELETE v0/posts/:id
// @desc Delete a post
// @access Private
router.delete(
	'/:id',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { id } = req.params;
		const { user, post } = req;
		try {
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot delete this post' });
			}

			await prisma.post.delete({
				where: {
					id,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route PUT v0/posts/:id
// @desc Update a post
// @access Private
router.put(
	'/:id',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { id } = req.params;
		const { user, post } = req;
		try {
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot update this post' });
			}

			const { content } = req.body;
			if (!content) {
				return res.status(400).json({ success: false, msg: 'Invalid post' });
			}

			const contentLength = content.length;

			if (contentLength === 0) {
				return res.status(400).json({ success: false, msg: 'Invalid post' });
			}

			if (contentLength > MAX_POST_BLOCKS) {
				return res
					.status(400)
					.json({ success: false, msg: 'Post is too long' });
			}

			await prisma.post.update({
				where: {
					id,
				},
				data: {
					content,
					updatedTime: new Date(),
				},
			});

			const postResponse = await createPostResponseForUserId(user.id, post);

			res.status(200).json({
				success: true,
				post: postResponse,
			});
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route GET v0/posts/:id/comments
// @desc Get comments on a post
// @access Private
router.get(
	'/:id/comments',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { user, post } = req;
		try {
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (!canUserViewPost(user, post)) {
				return res

					.status(403)
					.json({ success: false, msg: 'You cannot view this post' });
			}

			const comments = await prisma.comment.findMany({
				where: {
					postId: post.id,
				},
				orderBy: {
					createdTime: 'desc',
				},
			});

			const commentsResponse = await Promise.all(
				comments.map(async comment => {
					let author = null;
					if (comment.authorId === user.id) {
						author = user;
					} else {
						author = await prisma.user.findUnique({
							where: {
								id: comment.authorId,
							},
						});
					}

					if (!author) {
						return null;
					}

					return {
						id: comment.id,
						content: comment.content,
						createdTime: comment.createdTime,
						author,
					};
				})
			);

			res.status(200).json({ success: true, comments: commentsResponse });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts/:id/comment
// @desc Comment on a post
// @access Private
router.post(
	'/:id/comment',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { user, post } = req;
		try {
			const { content } = req.body;
			if (!content) {
				return res.status(400).json({ success: false, msg: 'Invalid comment' });
			}

			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			const canComment = await canUserCommentOnPost(user, post);
			if (!canComment) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot comment on this post' });
			}

			const contentLength = content.length;
			if (contentLength === 0) {
				return res.status(400).json({ success: false, msg: 'Invalid comment' });
			}

			if (contentLength > MAX_COMMENT_LENGTH) {
				return res
					.status(400)
					.json({ success: false, msg: 'Comment is too long' });
			}

			const comment = await prisma.comment.create({
				data: {
					content,
					authorId: user.id,
					postId: post.id,
					createdTime: new Date(),
				},
			});

			const commentResponse = {
				id: comment.id,
				content: comment.content,
				createdTime: comment.createdTime,
				postId: comment.postId,
			};

			return res.status(200).json({ success: true, comment: commentResponse });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route DELETE v0/posts/:id/comment/:commentId
// @desc Delete a comment
// @access Private
router.delete(
	'/:id/comment/:commentId',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { commentId } = req.params;
		const { user, post } = req;

		try {
			const comment = await prisma.comment.findUnique({
				where: {
					id: commentId,
				},
			});

			if (!comment || !user || !post) {
				return res
					.status(404)
					.json({ success: false, msg: 'Comment not found' });
			}

			if (comment.authorId !== user.id && post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot delete this comment' });
			}

			await prisma.comment.delete({
				where: {
					id: commentId,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts/:id/comment/:commentId/reply
// @desc Reply to a comment
// @access Private
router.post(
	'/:id/comment/:commentId/reply',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { commentId } = req.params;
		const { user, post } = req;
		try {
			const comment = await prisma.comment.findUnique({
				where: {
					id: commentId,
				},
			});

			if (!comment || !user || !post) {
				return res
					.status(404)
					.json({ success: false, msg: 'Comment not found' });
			}

			const { content } = req.body;
			if (!content) {
				return res.status(400).json({ success: false, msg: 'Invalid comment' });
			}

			const contentLength = content.length;

			if (contentLength === 0) {
				return res.status(400).json({ success: false, msg: 'Invalid comment' });
			}

			if (contentLength > MAX_COMMENT_LENGTH) {
				return res
					.status(400)
					.json({ success: false, msg: 'Comment is too long' });
			}

			const canComment = await canUserCommentOnPost(user, post);
			if (!canComment) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot reply to this comment' });
			}

			const reply = await prisma.commentReply.create({
				data: {
					content,
					authorId: user.id,
					parentId: comment.id,
					createdTime: new Date(),
				},
			});

			const replyResponse = await createCommentReplyResponse(reply, user);

			return res.status(200).json({ success: true, reply: replyResponse });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route DELETE v0/posts/:id/comment/:commentId/reply/:replyId
// @desc Delete a reply
// @access Private
router.delete(
	'/:id/comment/:commentId/reply/:replyId',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { replyId } = req.params;
		const { user, post } = req;

		try {
			const reply = await prisma.commentReply.findUnique({
				where: {
					id: replyId,
				},
			});

			if (!reply || !user || !post) {
				return res.status(404).json({ success: false, msg: 'Reply not found' });
			}

			if (reply.authorId !== user.id && post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot delete this reply' });
			}

			await prisma.commentReply.delete({
				where: {
					id: replyId,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts/:id/comments/disable
// @desc Disable comments on a post
// @access Private
router.post(
	'/:id/comments/disable',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { user, post } = req;

		try {
			if (!user || !post) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot disable comments' });
			}

			await prisma.post.update({
				where: {
					id: post.id,
				},
				data: {
					commentsDisabled: true,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

// @route POST v0/posts/:id/comments/enable
// @desc Enable comments on a post
// @access Private
router.post(
	'/:id/comments/enable',
	[auth, postMiddleware],
	async (req: Request, res: Response) => {
		const { user, post } = req;

		try {
			if (!user || !post) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (post.authorId !== user.id) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot enable comments' });
			}

			await prisma.post.update({
				where: {
					id: post.id,
				},
				data: {
					commentsDisabled: false,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({ success: false, error: err });
		}
	}
);

export default router;
