type FeedFriendship = {
	isFavorite: boolean;
	lastReadPostId: number | null;
	lastReadPostTime: Date;
	friend: {
		id: number;
		name: string;
		username: string;
		avatarSrc: string;
		posts: {
			id: number;
			createdTime: Date;
			content: any;
		}[];
	};
};

export function sortFeedFriendships(items: FeedFriendship[]): FeedFriendship[] {
	return items.sort((a, b) => {
		const lastPostA = a.friend.posts && a.friend.posts[0];
		const lastPostB = b.friend.posts && b.friend.posts[0];
		// rule 1: items without posts come last
		if (!lastPostA && !lastPostB) {
			return b.isFavorite ? 1 : -1;
		} else if (!lastPostA) {
			return 1;
		} else if (!lastPostB) {
			return -1;
		}

		const isAUnread = a.lastReadPostTime < lastPostA.createdTime;
		const isBUnread = b.lastReadPostTime < lastPostB.createdTime;

		if (isAUnread && !isBUnread) {
			return -1;
		} else if (!isAUnread && isBUnread) {
			return 1;
		}

		// rule 2: sort by post created time, descending
		if (lastPostA.createdTime > lastPostB.createdTime) {
			if (a.isFavorite !== b.isFavorite) {
				return a.isFavorite ? -1 : 1;
			}
			return -1;
		} else if (lastPostA.createdTime < lastPostB.createdTime) {
			if (a.isFavorite !== b.isFavorite) {
				return a.isFavorite ? -1 : 1;
			}
			return 1;
		}

		// rule 3: if equal, favorite comes first
		if (a.isFavorite !== b.isFavorite) {
			return a.isFavorite ? -1 : 1;
		}

		return 0;
	});
}
