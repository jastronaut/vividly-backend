import { User, Friendship } from '@prisma/client';
export type RequestUser = Pick<User, 'id' | 'name' | 'username' | 'bio'> & {
	friends: Friendship[];
};
