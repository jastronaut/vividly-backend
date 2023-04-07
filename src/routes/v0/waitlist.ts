import { Request, Response } from 'express';
import express from 'express';
import { prisma } from '../../app';

const router = express.Router();

// POST /v0/waitlist
// Create a new waitlist entry
router.post('/', async (req: Request, res: Response) => {
	const { email } = req.body;

	const waitlistEntry = await prisma.waitlist.create({
		data: {
			email,
			createdTime: new Date(),
		},
	});

	res.json(waitlistEntry);
});

export default router;
