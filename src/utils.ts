import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// validate username
export function validateUsername(username: string) {
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
	return usernameRegex.test(username);
}

// validate password
export function validatePassword(password: string) {
	return password.length >= 6;
}

// validate email
export function validateEmail(email: string) {
	const emailRegex =
		/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return emailRegex.test(email);
}

// from user ids, check if user1 is blocked by user2
export function isUserBlockedByUserByIds(user1Id: string, user2Id: string) {
	const user1BlockedByUser2 = prisma.blockedUser.findFirst({
		where: {
			blockedUserId: user1Id,
			blockerId: user2Id,
		},
	});

	return user1BlockedByUser2 !== null;
}
