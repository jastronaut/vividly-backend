import { Request, Response } from 'express';
import express from 'express';
import SendGrid from '@sendgrid/mail';

import { prisma } from '../../app';
import { auth } from '../../middleware/auth';
import {
	validateEmail,
	validateUsername,
	validateName,
	generateVerificationCode,
} from '../../utils';
import { RequestUser } from '../../types/types';

const router = express.Router();

// @route GET /v0/users/username/exists/:username
// @desc Check if username exists
// @access Public
router.get(
	'/username/exists/:username',
	async (req: Request, res: Response) => {
		const { username } = req.params;

		if (!validateUsername(username)) {
			return res.status(400).json({ error: 'Invalid username' });
		}

		try {
			const user = await prisma.user.findUnique({
				where: {
					username,
				},
			});

			if (user) {
				return res.status(200).json({ exists: true });
			}

			return res.status(200).json({ exists: false });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: 'Internal server error' });
		}
	}
);

// @route POST /v0/users/username/change
// @desc Change username
// @access Private
router.post('/username/change', auth, async (req: Request, res: Response) => {
	const { username } = req.body;
	const user = req.user as RequestUser;

	if (!validateUsername(username)) {
		return res.status(400).json({ error: 'Invalid username' });
	}

	try {
		const usernameUser = await prisma.user.findUnique({
			where: {
				username,
			},
		});

		if (usernameUser) {
			return res.status(400).json({ error: 'Username taken' });
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},

			data: {
				username,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route GET /v0/users/email/exists/:email
// @desc Check if email exists
// @access Public
router.get('/email/exists/:email', async (req: Request, res: Response) => {
	const { email } = req.params;

	if (!validateEmail(email)) {
		return res.status(400).json({ error: 'Invalid email' });
	}

	try {
		const user = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (user) {
			return res.status(200).json({ exists: true });
		}

		return res.status(200).json({ exists: false });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route POST /v0/users/name/change
// @desc Change name
// @access Private
router.post('/name/change', auth, async (req: Request, res: Response) => {
	const { name } = req.body;
	const user = req.user as RequestUser;

	if (!validateName(name)) {
		return res.status(400).json({ error: 'Invalid name' });
	}

	try {
		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				name,
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route POST /v0/users/email/change
// @desc Change email
// @access Private
router.post('/email/change', auth, async (req: Request, res: Response) => {
	const { email } = req.body;
	const user = req.user as RequestUser;

	if (!validateEmail(email)) {
		return res.status(400).json({ error: 'Invalid email' });
	}

	try {
		const emailUser = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (emailUser) {
			return res.status(400).json({ error: 'Email taken' });
		}

		const code = generateVerificationCode();

		await prisma.authUser.update({
			where: {
				id: user.id,
			},
			data: {
				email,
				verificationCode: code,
			},
		});

		const message = {
			from: 'peached.app@gmail.com',
			to: email,
			subject: 'Verify your email',
			html: `<p>Use code ${code} to verify your email.</p>`,
		};

		await SendGrid.send(message);

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// @route GET /v0/users/:id
// @desc Get user by id
// @access Public
router.get('/:id', async (req: Request, res: Response) => {
	const { id } = req.params;

	try {
		const user = await prisma.user.findUnique({
			where: {
				id,
			},
		});

		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		return res.status(200).json({
			id: user.id,
			username: user.username,
			name: user.name,
			bio: user.bio,
			avatarSrc: user.avatarSrc,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;
