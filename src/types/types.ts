import { User, Friendship } from '@prisma/client';
export type RequestUser = Pick<
	User,
	'id' | 'name' | 'username' | 'bio' | 'avatarSrc'
> & {
	friends: Friendship[];
};

export enum NotificationType {
	POST_LIKE = 'post_like',
	POST_MENTION = 'post_mention',
	COMMENT = 'post_comment',
	COMMENT_MENTION = 'post_comment_mention',
	ANNOUNCEMENT = 'announcement',
}
