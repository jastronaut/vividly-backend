import express from 'express';
import request from 'supertest';
import { User, BlockType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeAll, afterAll, it, describe, expect } from '@jest/globals';

import { prisma } from '../app';
import { getJwt } from '../utils';
import { getRandomMockUserData } from '../mockData';
import PostHandlers from '../routes/v0/posts';

const app = express();

let User1: User | null, User2: User | null, User3: User | null;

let User1JWT = '',
	User2JWT = '',
	User3JWT = '';

beforeAll(async () => {
	app.use(express.json());

	app.use('/api/v0/posts', PostHandlers);

	User1 = await getRandomMockUserData();
	User2 = await getRandomMockUserData();
	User3 = await getRandomMockUserData();

	const salt = await bcrypt.genSalt(10);
	const hash = await bcrypt.hash('', salt);

	User1JWT = getJwt(User1.id, hash);
	User2JWT = getJwt(User2.id, hash);
	User3JWT = getJwt(User3.id, hash);

	await prisma.friendship.create({
		data: {
			userId: User1.id,
			friendId: User2.id,
			lastReadPostTime: new Date(),
		},
	});

	await prisma.friendship.create({
		data: {
			userId: User2.id,
			friendId: User1.id,
			lastReadPostTime: new Date(),
		},
	});

	await prisma.friendship.create({
		data: {
			userId: User3.id,
			friendId: User2.id,
			lastReadPostTime: new Date(),
		},
	});

	await prisma.friendship.create({
		data: {
			userId: User2.id,
			friendId: User3.id,
			lastReadPostTime: new Date(),
		},
	});
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

describe('POST /api/v0/posts', () => {
	it(`should create a post with one text block`, async () => {
		const res = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		expect(res.status).toBe(200);
		const { post } = res.body;
		expect(post.author.id).toBe(User1!.id);
		expect(post.content.length).toBe(1);
		expect(post.content[0].type).toBe(BlockType.TEXT);
		expect(post.content[0].text.content).toBe('Hello World');
	});
});

describe('POST /api/v0/posts', () => {
	it(`should create a post with multiple blocks`, async () => {
		const res = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [
					{ type: BlockType.TEXT, text: { content: 'Hello World' } },
					{
						type: BlockType.IMAGE,
						image: {
							url: 'https://i.ibb.co/CnxM4Hj/grid-0-2.jpg',
							width: 100,
							height: 100,
						},
					},
				],
			});
		expect(res.status).toBe(200);
		const { post } = res.body;
		expect(post.author.id).toBe(User1!.id);
		expect(post.content.length).toBe(2);
		expect(post.content[0].type).toBe(BlockType.TEXT);
		expect(post.content[0].text.content).toBe('Hello World');
		expect(post.content[1].type).toBe(BlockType.IMAGE);
		expect(post.content[1].image.url).toBe(
			'https://i.ibb.co/CnxM4Hj/grid-0-2.jpg'
		);
	});
});

describe('GET /api/v0/posts', () => {
	it(`should get a user's own post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.get(`/api/v0/posts/${postRes.body.post.id}`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(200);
		const { post } = res.body;
		expect(post.author.id).toBe(User1!.id);
		expect(post.content.length).toBe(1);
		expect(post.content[0].type).toBe(BlockType.TEXT);
		expect(post.content[0].text.content).toBe('Hello World');
	});
});

describe('GET /api/v0/posts', () => {
	it(`should get a friend's post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.get(`/api/v0/posts/${postRes.body.post.id}`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);
		const { post } = res.body;
		expect(post.author.id).toBe(User1!.id);
		expect(post.content.length).toBe(1);
		expect(post.content[0].type).toBe(BlockType.TEXT);
		expect(post.content[0].text.content).toBe('Hello World');
	});
});

describe('GET /api/v0/posts', () => {
	it(`should not get a non-friend's post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User3JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.get(`/api/v0/posts/${postRes.body.post.id}`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(403);
	});
});

describe('DELETE /api/v0/posts', () => {
	it(`should delete a post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.delete(`/api/v0/posts/${postRes.body.post.id}`)
			.set('x-auth-token', User1JWT);
		expect(res.status).toBe(200);
	});
});

describe('DELETE /api/v0/posts', () => {
	it(`should not delete another user's post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.delete(`/api/v0/posts/${postRes.body.post.id}`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(403);
	});
});

describe('POST /api/v0/posts/:id/like', () => {
	it(`should like a post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.post(`/api/v0/posts/${postRes.body.post.id}/like`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);

		const post = await prisma.post.findUnique({
			where: { id: postRes.body.post.id },
		});
		expect(post!.likedByIds.length).toBe(1);
	});
});

describe('POST /api/v0/posts/:id/like', () => {
	it(`should like and unlike a post`, async () => {
		const postRes = await request(app)
			.post(`/api/v0/posts`)
			.set('x-auth-token', User1JWT)
			.send({
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
			});
		const res = await request(app)
			.post(`/api/v0/posts/${postRes.body.post.id}/like`)
			.set('x-auth-token', User2JWT);
		expect(res.status).toBe(200);

		const post = await prisma.post.findUnique({
			where: { id: postRes.body.post.id },
		});
		expect(post!.likedByIds.length).toBe(1);

		const unlikeRes = await request(app)
			.post(`/api/v0/posts/${postRes.body.post.id}/unlike`)
			.set('x-auth-token', User2JWT);
		expect(unlikeRes.status).toBe(200);

		const postAfterUnlike = await prisma.post.findUnique({
			where: { id: postRes.body.post.id },
		});
		expect(postAfterUnlike!.likedByIds.length).toBe(0);
	});
});

describe('POST /api/v0/posts/:id/comment', () => {
	it(`should comment on a post`, async () => {
		const post = await prisma.post.create({
			data: {
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
				authorId: User1!.id,
				updatedTime: new Date(),
				createdTime: new Date(),
			},
		});

		const res = await request(app)
			.post(`/api/v0/posts/${post.id}/comment`)
			.set('x-auth-token', User2JWT)
			.send({
				content: 'This is a comment',
			});
		expect(res.status).toBe(200);

		const updatedPost = await prisma.post.findUnique({
			where: { id: post.id },
			select: {
				comments: true,
			},
		});
		expect(updatedPost!.comments.length).toBe(1);
		expect(updatedPost!.comments[0].content).toBe('This is a comment');
	});
});

describe('POST /api/v0/posts/:id/comment', () => {
	it(`should not comment on non friend's post`, async () => {
		const post = await prisma.post.create({
			data: {
				content: [{ type: BlockType.TEXT, text: { content: 'Hello World' } }],
				authorId: User1!.id,
				updatedTime: new Date(),
				createdTime: new Date(),
			},
		});

		const res = await request(app)
			.post(`/api/v0/posts/${post.id}/comment`)
			.set('x-auth-token', User3JWT)
			.send({
				content: 'This is a comment',
			});
		expect(res.status).toBe(403);

		const updatedPost = await prisma.post.findUnique({
			where: { id: post.id },
			select: {
				comments: true,
			},
		});
		expect(updatedPost!.comments.length).toBe(0);
	});
});
