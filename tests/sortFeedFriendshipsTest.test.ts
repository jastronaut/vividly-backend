// import jest stuff
import { expect, test } from '@jest/globals';

import {
	sortFeedFriendships,
	FeedFriendship,
} from '../src/sortFeedFriendships';

const createReadableDate = (date: Date) => {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const testData: FeedFriendship[] = [
	// user who is not favorite and has no posts
	{
		isFavorite: false,
		lastReadPostId: null,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 1,
			name: 'test1',
			username: 'test1',
			avatarSrc: 'test1',
			posts: [],
		},
	},
	// user who is favorite and has no posts
	{
		isFavorite: true,
		lastReadPostId: null,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 2,
			name: 'test2',
			username: 'test2',
			avatarSrc: 'test2',
			posts: [],
		},
	},

	// user who is favorite and has a post that has been read
	{
		isFavorite: true,
		lastReadPostId: 1,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 3,
			name: 'test3',
			username: 'test3',
			avatarSrc: 'test3',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-01'),
					content: 'test3',
				},
			],
		},
	},

	// user who is favorite and has a newer post that has been read
	{
		isFavorite: true,
		lastReadPostId: 1,
		lastReadPostTime: new Date('2020-01-03'),
		friend: {
			id: 33,
			name: 'test33',
			username: 'test33',
			avatarSrc: 'test33',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-03'),
					content: 'test33',
				},
			],
		},
	},

	// user who is not favorite and has a post that has been read
	{
		isFavorite: false,
		lastReadPostId: 1,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 4,
			name: 'test4',
			username: 'test4',
			avatarSrc: 'test4',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-01'),
					content: 'test4',
				},
			],
		},
	},

	// user who is not favorite and has a newer post that has been read
	{
		isFavorite: false,
		lastReadPostId: 1,
		lastReadPostTime: new Date('2020-01-03'),
		friend: {
			id: 44,
			name: 'test44',
			username: 'test44',
			avatarSrc: 'test44',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-03'),
					content: 'test44',
				},
			],
		},
	},

	// user who is favorite and has a post that has not been read
	{
		isFavorite: true,
		lastReadPostId: 0,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 5,
			name: 'test5',
			username: 'test5',
			avatarSrc: 'test5',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-02'),
					content: 'test5',
				},
			],
		},
	},

	// user who is favorite and has a newer post that has not been read
	{
		isFavorite: true,
		lastReadPostId: 0,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 55,
			name: 'test55',
			username: 'test55',
			avatarSrc: 'test55',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-03'),
					content: 'test55',
				},
			],
		},
	},

	// user who is not favorite and has a post that has not been read
	{
		isFavorite: false,
		lastReadPostId: 0,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 6,
			name: 'test6',
			username: 'test6',
			avatarSrc: 'test6',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-02'),
					content: 'test6',
				},
			],
		},
	},

	// user who is not favorite and has a newer post that has not been read
	{
		isFavorite: false,
		lastReadPostId: 0,
		lastReadPostTime: new Date('2020-01-01'),
		friend: {
			id: 7,
			name: 'test7',
			username: 'test7',
			avatarSrc: 'test7',
			posts: [
				{
					id: 1,
					createdTime: new Date('2020-01-03'),
					content: 'test7',
				},
			],
		},
	},
];

test('sortFeedFriendships', () => {
	const sorted = sortFeedFriendships(testData);

	let str = '';
	sorted.forEach(item => {
		const createdTime = item.friend.posts[0]?.createdTime
			? createReadableDate(item.friend.posts[0].createdTime)
			: '-';

		const lastReadPostTime = createReadableDate(item.lastReadPostTime);
		str += `* id: ${item.friend.id}, isFavorite: ${item.isFavorite}, lastReadPostTime: ${lastReadPostTime}, createdTime: ${createdTime}\n`;
	});

	console.log(str);
	expect(sorted[0].friend.id).toBe(55);
	expect(sorted[1].friend.id).toBe(5);
	expect(sorted[2].friend.id).toBe(7);
	expect(sorted[3].friend.id).toBe(6);
	expect(sorted[4].friend.id).toBe(33);
	expect(sorted[5].friend.id).toBe(3);
	expect(sorted[6].friend.id).toBe(44);
	expect(sorted[7].friend.id).toBe(4);
	expect(sorted[8].friend.id).toBe(2);
	expect(sorted[9].friend.id).toBe(1);
});
