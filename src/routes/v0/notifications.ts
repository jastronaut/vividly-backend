import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

// @route GET /v0/notifications
// @desc Get notifications
// @access Private
router.get('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const notifications = await prisma.notification.findMany({
			where: {
				userId: user.id,
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
		});

		return res.status(200).json({ success: true, notifications });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, error: err });
	}
});

export default router;
