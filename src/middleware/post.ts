import { Request, Response, NextFunction } from 'express';

import { prisma } from '../app';

export function postMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const id = parseInt(req.params.id);
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
