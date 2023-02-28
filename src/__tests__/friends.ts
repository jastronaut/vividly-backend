import express from 'express';
import request from 'supertest';
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeAll, afterAll, it, describe, expect } from '@jest/globals';

import { getJwt } from '../utils';
import { getRandomMockUserData, getMockUserJwt } from '../mockData';

import FriendHandlers from '../routes/v0/friends';

const app = express();

const prisma = new PrismaClient();

let User1: User | null, User2: User | null, User3: User | null;

let User1JWT = '',
	User2JWT = '',
	User3JWT = '';

beforeAll(async () => {
	app.use(express.json());

	app.use('/api/v0/friends', FriendHandlers);

	User1 = await getRandomMockUserData();
	User2 = await getRandomMockUserData();
	User3 = await getRandomMockUserData();

	const salt = await bcrypt.genSalt(10);
	const hash = await bcrypt.hash('', salt);

	User1JWT = getJwt(User1.id, hash);
	User2JWT = getJwt(User2.id, hash);
	User3JWT = getJwt(User3.id, hash);
});

afterAll(async () => {
	const deleteUsers = prisma.user.deleteMany();
	const deleteFriendRequests = prisma.friendRequest.deleteMany();
	const deleteFriendships = prisma.friendship.deleteMany();

	await prisma.$transaction([
		deleteUsers,
		deleteFriendRequests,
		deleteFriendships,
	]);

	await prisma.$disconnect();
});

describe('GET /api/v0/friends', () => {
	it(`should return an empty list of friends`, async () => {
		const res = await request(app)
			.get(`/api/v0/friends`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(200);
		expect(res.body.length).toBe(0);
	});
});

describe('POST /api/v0/friends/add', () => {
	it(`should send friend request from user1 to user2`, async () => {
		const res = await request(app)
			.post(`/api/v0/friends/add/${User2!.id}`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(200);
		expect(res.body.fromUserId).toBe(User1!.id);
		expect(res.body.toUserId).toBe(User2!.id);
	});
});

describe('POST /api/v0/friends/add', () => {
	it(`should send a friend request from user3 to user2`, async () => {
		const res2 = await request(app)
			.post(`/api/v0/friends/add/${User2!.id}`)
			.set('x-auth-token', User3JWT);
		expect(res2.status).toBe(200);
		expect(res2.body.fromUserId).toBe(User3!.id);
		expect(res2.body.toUserId).toBe(User2!.id);
	});
});

describe('GET /api/v0/friends/requests', () => {
	it(`should return an list friend requests to user2`, async () => {
		const res = await request(app)
			.get(`/api/v0/friends/requests`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);
		expect(res.body.length).toBe(2);
		expect(res.body[0].fromUserId).toBe(User1!.id);
		expect(res.body[0].toUserId).toBe(User2!.id);
		expect(res.body[1].fromUserId).toBe(User3!.id);
		expect(res.body[1].toUserId).toBe(User2!.id);
	});
});

describe('POST /api/v0/friends/accept', () => {
	it(`should accept friend request from user1 to user2`, async () => {
		const res = await request(app)
			.post(`/api/v0/friends/accept/${User1!.id}`)
			.set('x-auth-token', User2JWT)
			.send({ username: User1!.username });
		expect(res.status).toBe(200);
		expect(res.body.friendId).toBe(User1!.id);
		expect(res.body.userId).toBe(User2!.id);
	});
});

describe('GET /api/v0/friends', () => {
	it(`should return a list of user 1's friends`, async () => {
		const res = await request(app)
			.get(`/api/v0/friends`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(200);
		expect(res.body.length).toBe(1);
		expect(res.body[0].userId).toBe(User1!.id);
		expect(res.body[0].friendId).toBe(User2!.id);
	});
});

describe('POST /api/v0/friends/reject', () => {
	it(`should reject friend request from user3 to user2`, async () => {
		const res = await request(app)
			.post(`/api/v0/friends/reject/${User3!.id}`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);
	});
});

describe('GET /api/v0/friends/requests', () => {
	it(`should return an empty list of friend requests to user2`, async () => {
		const res = await request(app)
			.get(`/api/v0/friends/requests`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);
		expect(res.body.length).toBe(0);
	});
});
