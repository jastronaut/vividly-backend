import { PrismaClient, Comment, Post, CommentReply } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';
import { postMiddleware } from '../../middleware/post';

const router = express.Router();
const prisma = new PrismaClient();

// @route  GET /v0/friends
// @desc   Get all friends
// @access Private
router.get('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;

		const friends = await prisma.friendship.findMany({
			where: {
				userId: user.id,
			},
		});

		res.status(200).json(friends);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Server error' });
	}
});
