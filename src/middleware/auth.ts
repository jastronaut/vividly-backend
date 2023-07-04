import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../app';

const JWT_SECRET = process.env.PEACHED_JWT_SECRET || '';

export function auth(req: Request, res: Response, next: NextFunction) {
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

		prisma.user
			.findUnique({
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
				},
			})
			.then(user => {
				if (!user) {
					return res
						.status(404)
						.json({ success: false, msg: 'User not found' });
				}
				const reqUser = {
					id: user.id,
					name: user.name,
					username: user.username,
					bio: user.bio,
					friends: user.friends,
					avatarSrc: user.avatarSrc,
				};
				req.user = reqUser;
				next();
			});
	} catch (e) {
		console.error(e);
		return res.status(400).json({ success: false, msg: 'Token is not valid' });
	}
}

export function verifyEmail(req: Request, res: Response, next: NextFunction) {
	next();
}
