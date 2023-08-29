import { PrismaClient } from '@prisma/client';
const JWT_SECRET = process.env.PEACHED_JWT_SECRET || '';
import jwt from 'jsonwebtoken';

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
	const isTestAccount =
		email.startsWith('peached.app+') && email.endsWith('@gmail.com');
	const isAdminAccount = email.endsWith('@vividly.love');
	return isTestAccount || isAdminAccount;
}

export function validateName(name: string) {
	const nameRegex = /^[\s\S]{1,20}$/;
	return nameRegex.test(name);
}

// from user ids, check if user1 is blocked by user2
export function isUserBlockedByUserByIds(user1Id: number, user2Id: number) {
	const user1BlockedByUser2 = prisma.block.findFirst({
		where: {
			blockedUserId: user1Id,
			blockerId: user2Id,
		},
	});

	return user1BlockedByUser2 !== null;
}

export function getJwt(userId: number, passwordHash: string) {
	if (!JWT_SECRET) {
		throw new Error('JWT_SECRET is not defined');
	}

	return jwt.sign({ id: userId, passwordHash }, JWT_SECRET);
}

export function generateVerificationCode(len = 7) {
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let code = '';
	for (let i = 0; i < len; i++) {
		code += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return code;
}

export function validateImgSrc(imgSrc: string) {
	return (
		imgSrc.endsWith('.jpg') ||
		imgSrc.endsWith('.jpeg') ||
		imgSrc.endsWith('.png')
	);
}

export function validateBio(bio: string) {
	return bio.length <= 150;
}

export function createVerificationExpiryTime() {
	return new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString();
}

export function createVerifyEmailMessage(
	username: string,
	name: string,
	email: string,
	code: string
) {
	const message = {
		from: { email: 'notify@vividly.love', name: 'Vividly' },
		to: { email: email, name: name },
		subject: 'Verify your email',
		html: `<p>Click <a href="http://localhost:3000/verify/${code}">here</a> to verify your email</p>`,
		templateId: 'd-54260593ff0c4e6aa1503828726ddff2',
		dynamicTemplateData: {
			username: '@' + username,
			first_name: '@' + username,
			verify_url: `http://localhost:3000/verify/${code}`,
		},
	};

	return message;
}

export function getMentionedUsernames(content: string) {
	const matches = content.match(/@\w+/g);
	if (!matches) {
		return new Set();
	}
	const mentionsUsernames = matches.map(mention => mention.slice(1));
	return new Set(mentionsUsernames);
}
