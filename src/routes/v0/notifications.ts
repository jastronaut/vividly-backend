import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

const NOTIFS_PAGE_LENGTH = 50;

// @route GET /v0/notifications
// @desc Get notifications
// @access Private
router.get('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const cursor = parseInt(req.query.cursor as string);

		const blockedUsers = await prisma.blockedUser.findMany({
			select: {
				blockedUserId: true,
			},
			where: {
				blockerId: user.id,
			},
		});

		let notifications = [];

		if (!cursor) {
			notifications = await prisma.notification.findMany({
				where: {
					userId: user.id,
					sender: {
						id: {
							notIn: blockedUsers.map(blockedUser => blockedUser.blockedUserId),
						},
					},
				},
				orderBy: {
					createdTime: 'desc',
				},
				select: {
					id: true,
					createdTime: true,
					isUnread: true,
					body: true,
					sender: {
						select: {
							id: true,
							username: true,
							avatarSrc: true,
							bio: true,
							name: true,
						},
					},
				},
				take: NOTIFS_PAGE_LENGTH + 1,
			});
		} else {
			notifications = await prisma.notification.findMany({
				cursor: {
					id: cursor,
				},
				where: {
					userId: user.id,
					sender: {
						id: {
							notIn: blockedUsers.map(blockedUser => blockedUser.blockedUserId),
						},
					},
				},
				orderBy: {
					createdTime: 'desc',
				},
				take: NOTIFS_PAGE_LENGTH + 1,
				skip: 1,
				select: {
					id: true,
					createdTime: true,
					isUnread: true,
					body: true,
					sender: {
						select: {
							id: true,
							username: true,
							avatarSrc: true,
							bio: true,
							name: true,
						},
					},
				},
			});
		}

		const unreadCount = await prisma.notification.count({
			where: {
				userId: user.id,
				isUnread: true,
			},
		});

		const len = notifications.length;

		let newCursor = null;
		if (len > NOTIFS_PAGE_LENGTH) {
			newCursor = notifications[len - 2].id;
		}

		return res.status(200).json({
			success: true,
			data: {
				notifications: notifications,
				unreadCount: unreadCount,
				totalCount: len,
			},
			cursor: newCursor,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, error: err });
	}
});

// @route POST /v0/notifications/read
// @desc Mark notifications as read
// @access Private
router.post('/read', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		await prisma.notification.updateMany({
			where: {
				userId: user.id,
				isUnread: true,
			},
			data: {
				isUnread: false,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, error: err });
	}
});

export default router;
