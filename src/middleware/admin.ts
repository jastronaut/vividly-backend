import { Request, Response, NextFunction } from 'express';

import { prisma } from '../app';
import { RequestUser } from '../types/types';

export async function adminMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const user = req.user as RequestUser;

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				id: user.id,
			},
			select: {
				isAdmin: true,
			},
		});

		if (!authUser || !authUser.isAdmin) {
			return res.status(403).json({ success: false, msg: 'Forbidden' });
		}
		next();
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, msg: 'Server error' });
	}
}
