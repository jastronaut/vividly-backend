import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';

import { auth } from '../../middleware/auth';
import { validateEmail, validateUsername, validateName } from '../../utils';
import { RequestUser } from '../../types/types';

const router = express.Router();
const prisma = new PrismaClient();

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
		const user = await prisma.user.findUnique({
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
