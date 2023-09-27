import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { auth } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';

const router = express.Router();

const userSelectOptions = {
	id: true,
	name: true,
	username: true,
	bio: true,
	avatarSrc: true,
	isDeactivated: true,
	url: true,
	authUser: {
		select: {
			email: true,
			emailVerified: true,
			verificationCode: true,
			verificationExpiresAt: true,
			resetCode: true,
			isAdmin: true,
		},
	},
	reports: {
		select: {
			id: true,
			reason: true,
			comment: true,
			itemType: true,
			itemId: true,
			createdTime: true,
		},
	},
	blocked: {
		select: {
			id: true,
			blockedUser: {
				select: {
					id: true,
					name: true,
					username: true,
					avatarSrc: true,
				},
			},
		},
	},
};

// @route GET /v0/admin/user/id/:id
// @desc Get info for user by id
// @access Private
router.get(
	'/user/id/:id',
	[auth, adminMiddleware],
	async (req: Request, res: Response) => {
		const { id } = req.params;
		try {
			const user = await prisma.user.findUnique({
				select: userSelectOptions,
				where: {
					id: parseInt(id),
				},
			});
			return res.status(200).json({ success: true, user });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ success: false, error: err });
		}
	}
);

// @route GET /v0/admin/user/username/:username
// @desc Get info for user by username
// @access Private
router.get(
	'/user/username/:username',
	[auth, adminMiddleware],
	async (req: Request, res: Response) => {
		const { username } = req.params;
		try {
			const user = await prisma.user.findUnique({
				select: userSelectOptions,
				where: {
					username,
				},
			});
			return res.status(200).json({ success: true, user });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ success: false, error: err });
		}
	}
);

// @route GET /v0/admin/user/email/:email
// @desc Get info for user by email
// @access Private
router.get(
	'/user/email/:email',
	[auth, adminMiddleware],
	async (req: Request, res: Response) => {
		const { email } = req.params;
		try {
			const authUser = await prisma.authUser.findUnique({
				where: {
					email,
				},
			});
			if (!authUser) {
				return res
					.status(404)
					.json({ success: false, error: 'User not found' });
			}

			const user = await prisma.user.findUnique({
				select: userSelectOptions,
				where: {
					id: authUser.id,
				},
			});

			if (!user) {
				return res
					.status(404)
					.json({ success: false, error: 'User not found' });
			}

			return res.status(200).json({ success: true, user });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ success: false, error: err });
		}
	}
);

export default router;
