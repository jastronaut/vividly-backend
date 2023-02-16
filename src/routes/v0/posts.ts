import { PrismaClient, Comment, Post, CommentReply } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';
import { postMiddleware } from '../../middleware/post';
import { isUserBlockedByUserByIds } from '../../utils';

const router = express.Router();
const prisma = new PrismaClient();

const MAX_POST_BLOCKS = 50;
const MAX_COMMENT_LENGTH = 1000;

function canUserViewPost(user: RequestUser, post: Post) {
	const authorId = post.authorId;
	if (authorId === user.id) {
		return true;
	}

	const isFriend = user.friends.some(friend => friend.id === authorId);
	return isFriend;
}

function canUserCommentOnPost(user: RequestUser, post: Post) {
	const canView = canUserViewPost(user, post);
	if (!canView) {
		console.log('one');
		return false;
	}

	if (post.commentsDisabled && post.authorId !== user.id) {
		console.log('two');
		return false;
	}

	const isBlocked =
		user.id !== post.authorId &&
		isUserBlockedByUserByIds(user.id, post.authorId);
	console.log('three');
	return !isBlocked;
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

	return {
		...post,
		likes: likesLen,
		likedByUser,
		author: {
			id: author.id,
			name: author.name,
			username: author.username,
			profilePicture: author.profilePicture,
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
			profilePicture: replyAuthorSearch.profilePicture,
		};
	}

	return {
		...commentReply,
		author: replyAuthor,
	};
}

async function createCommentResponse(comment: Comment, author?: RequestUser) {
	let postAuthor = null;

	if (author) {
		postAuthor = author;
	} else if (!postAuthor) {
		const postAuthorSearch = await prisma.user.findUnique({
			where: {
				id: comment.authorId,
			},
		});

		if (!postAuthorSearch) {
			throw new Error('Comment author not found');
		}

		postAuthor = {
			id: postAuthorSearch.id,
			name: postAuthorSearch.name,
			username: postAuthorSearch.username,
			profilePicture: postAuthorSearch.profilePicture,
		};
	}

	return {
		...comment,
		author: postAuthor,
	};
}

// @route GET v0/posts
// @desc Get Post by ID
// @access Public
router.get('/:id', auth, async (req: Request, res: Response) => {
	const { id } = req.params;
	try {
		const post = await prisma.post.findUnique({
			where: {
				id,
			},
		});

		if (!post || !req.user) {
			return res.status(404).json({ success: false, msg: 'Post not found' });
		}

		if (!canUserViewPost(req.user, post)) {
			return res
				.status(403)
				.json({ success: false, msg: 'You cannot view this post' });
		}

		const postResponse = await createPostResponseForUserId(req.user.id, post);
		res.status(200).json({ success: true, post: postResponse });
	} catch (err) {
		res.status(500).json({ success: false, error: err });
	}
});

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

		res.status(200).json({ success: true });
	} catch (err) {
		res.status(500).json({ success: false, error: err });
	}
});

// @route POST v0/posts/id/unlike
// @desc Unlike a post
// @access Private
router.post('/:id/unlike', auth, async (req: Request, res: Response) => {
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
				likedByIds: [...post.likedByIds, user.id],
			},
		});

		res.status(200).json({ success: true });
	} catch (err) {
		res.status(500).json({ success: false, error: err });
	}
});

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
router.delete('/:id', auth, async (req: Request, res: Response) => {
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
});

// @route PUT v0/posts/:id
// @desc Update a post
// @access Private
router.put('/:id', auth, async (req: Request, res: Response) => {
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
			return res.status(400).json({ success: false, msg: 'Post is too long' });
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
});

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
			if (!post || !user) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}

			if (!canUserCommentOnPost(user, post)) {
				return res
					.status(403)
					.json({ success: false, msg: 'You cannot comment on this post' });
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

			const comment = await prisma.comment.create({
				data: {
					content,
					authorId: user.id,
					postId: post.id,
					createdTime: new Date(),
				},
			});

			const commentResponse = await createCommentResponse(comment, user);

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

			if (canUserCommentOnPost(user, post)) {
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

export default router;
