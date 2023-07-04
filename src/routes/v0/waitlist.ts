import { Request, Response } from 'express';
import express from 'express';
import SendGrid from '@sendgrid/mail';

SendGrid.setApiKey(process.env.SENDGRID_API_KEY || '');

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

	const message = {
		from: { email: 'notify@vividly.love', name: 'Vividly' },
		to: email,
		subject: 'Thanks for your interest in Vividly!',
		html: `<p>We'll send you an email when we're ready to launch and when we're ready for beta testers.</p>`,
		templateId: 'd-57c39d4a3ca04864bc2c58c48e80f000',
	};

	await SendGrid.send(message);

	res.json(waitlistEntry);
});

export default router;
