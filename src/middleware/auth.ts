import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../app';

const JWT_SECRET = process.env.VIVIDLY_JWT_SECRET_0 || '';

export async function auth(req: Request, res: Response, next: NextFunction) {
	const token = req.header('Authorization')?.replace('Bearer ', '');

	if (!token) {
		return res
			.status(401)
			.json({ success: false, msg: 'No token, authorization denied' });
	}

	if (!JWT_SECRET) {
		return res.status(400).json({ success: false, msg: 'Token is not valid' });
	}

	// Verify token
	const jwtPayload = jwt.verify(token, JWT_SECRET);
	const { id, passwordHash } = jwtPayload as {
		id: string;
		passwordHash: string;
	};

	try {
		if (!id || !passwordHash) {
			throw new Error('Invalid token');
		}
		const intId = parseInt(id);

		const user = await prisma.user.findUnique({
			where: {
				id: intId,
			},
			select: {
				authUser: true,
				friends: true,
				id: true,
				name: true,
				username: true,
				bio: true,
				avatarSrc: true,
				blocked: true,
			},
		});
		if (!user) {
			return res.status(404).json({ success: false, msg: 'User not found' });
		}
		const blocked = await prisma.block.findMany({
			where: {
				blockerId: user.id,
			},
			select: {
				id: true,
				blockedUserId: true,
			},
		});

		const reqUser = {
			id: user.id,
			name: user.name,
			username: user.username,
			bio: user.bio,
			friends: user.friends,
			avatarSrc: user.avatarSrc,
			blockedUsers: blocked,
		};
		req.user = reqUser;
		next();
	} catch (e) {
		console.error(e);
		return res.status(400).json({ success: false, msg: 'Token is not valid' });
	}
}

export function verifyEmail(req: Request, res: Response, next: NextFunction) {
	next();
}
