import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export function postMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const prisma = new PrismaClient();
	const { id } = req.params;
	prisma.post
		.findUnique({
			where: {
				id,
			},
		})
		.then(post => {
			if (!post) {
				return res.status(404).json({ success: false, msg: 'Post not found' });
			}
			req.post = post;
			next();
		})
		.catch(e => {
			console.error(e);
			return res.status(500).json({ success: false, msg: 'Server error' });
		});
}
