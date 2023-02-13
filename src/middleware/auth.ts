import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.PEACHED_JWT_SECRET || '';

export function auth(req: Request, res: Response, next: NextFunction) {
	const token = req.header('x-auth-token');

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

		prisma.user
			.findUnique({
				where: {
					id,
				},
			})
			.then(user => {
				if (!user) {
					throw new Error('User does not exist');
				}

				const reqUser = {
					id: user.id,
					name: user.name,
					username: user.username,
					bio: user.bio,
					friends: user.friends,
				};
				req.user = reqUser;

				next();
			});
	} catch (e) {
		console.error(e);
		return res.status(400).json({ success: false, msg: 'Token is not valid' });
	}
}
