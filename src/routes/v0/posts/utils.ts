import { Post } from '@prisma/client';

import { prisma } from '../../../app';
import { RequestUser, NotificationType } from '../../../types/types';

export async function canUserViewPost(user: RequestUser, post: Post) {
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

	// only friends can view posts
	if (friendship1 === null || friendship2 === null) {
		return false;
	}

	// if post is for favorites only, check if friend is a favorite
	if (post.favoritesOnly && !friendship1.isFavorite) {
		return false;
	}

	return true;
}

export async function canUserCommentOnPost(user: RequestUser, post: Post) {
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

export async function createPostResponseForUserId(
	userId: number,
	post: Post,
	blockedUsers: { blockedUserId: number }[]
) {
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
			authorId: {
				notIn: blockedUsers.map(blockedUser => blockedUser.blockedUserId),
			},
		},
		orderBy: {
			createdTime: 'asc',
		},
		include: {
			author: true,
		},
	});

	return {
		id: post.id,
		createdTime: post.createdTime,
		commentsDisabled: post.commentsDisabled,
		authorId: post.authorId,
		content: post.content,
		likes: likesLen,
		isLikedByUser: likedByUser,
		comments,
		author: {
			id: author.id,
			name: author.name,
			username: author.username,
			avatarSrc: author.avatarSrc,
		},
	};
}

function findMentionMatches(content: string) {
	return content.match(/@(\w+)/g);
}

export async function findPostMentionsAndNotify(
	content: any, // JSON
	userId: number,
	postId: number,
	username: string,
	blockedUserNames: { username: string }[]
) {
	const mentions = new Set();

	for (const block of content) {
		if (block.type === 'text') {
			const matches = findMentionMatches(block.text);
			if (!matches) {
				continue;
			}
			for (const match of matches) {
				const name = match.slice(1);
				const isBlocked = blockedUserNames.find(user => user.username === name);
				if (name !== username && !isBlocked) {
					mentions.add(name);
				}
			}
		}
	}

	// add all mentions to a list
	const mentionsList: string[] = Array.from(mentions) as string[];
	// add notification for each mention
	await Promise.all(
		mentionsList.map(async (mention: string) => {
			const mentionedUser = await prisma.user.findUnique({
				where: {
					username: mention,
				},
			});

			if (mentionedUser) {
				// has the mentioned user blocked the user who is mentioning them?
				const blockedByMentioned = await prisma.block.findFirst({
					where: {
						blockerId: mentionedUser.id,
						blockedUserId: userId,
					},
				});

				if (blockedByMentioned) {
					return;
				}

				await prisma.notification.create({
					data: {
						userId: mentionedUser.id,
						createdTime: new Date(),
						senderId: userId,
						body: {
							type: NotificationType.POST_MENTION,
							post: {
								id: postId,
								block: content[0],
							},
						},
					},
				});
			}
		})
	);
}
