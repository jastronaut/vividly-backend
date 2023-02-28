import { User, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { getJwt } from './utils';

const prisma = new PrismaClient();

export type MockUser = {
	username: string;
	email: string;
	name: string;
	password: string;
};

export const getRandomText = (length: number): string => {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
};

export const getRandomMockUserData = async (): Promise<User> => {
	const username = getRandomText(10);
	const email = `${username + getRandomText(5)}@${getRandomText(5)}.com`;
	const name = getRandomText(10);
	const password = getRandomText(10);

	return await prisma.user.create({
		data: {
			username,
			name,
			authUser: {
				create: {
					email,
					password,
				},
			},
		},
	});
};

export const getMockUserJwt = async (id: string, pw: string) => {
	const salt = await bcrypt.genSalt(10);
	const hash = await bcrypt.hash(pw, salt);
	return getJwt(id, hash);
};

export const getMockPostData = async (userId: string, time?: string) => {
	const text = getRandomText(100);

	const createdTime = time ? new Date(time) : new Date();

	const data: {
		content: string;
		authorId: string;
		createdTime: Date;
		updatedTime: Date;
	} = {
		content: text,
		authorId: userId,
		createdTime,
		updatedTime: createdTime,
	};
};
