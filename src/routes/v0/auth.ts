import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';

import {
	validateEmail,
	validatePassword,
	validateUsername,
	getJwt,
} from '../../utils';

const router = express.Router();
const prisma = new PrismaClient();

// @route POST auth/login
// @desc Login a User
// @access Public
router.post('/login', async (req: Request, res: Response) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ msg: 'Please enter all fields' });
	}

	try {
		// check if user exists
		const user = await prisma.user.findUnique({
			where: {
				username,
			},
		});

		if (!user) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		const hash = user.password;
		const match = await bcrypt.compare(password, hash);
		if (!match) {
			return res.status(400).json({ msg: 'Invalid credentials' });
		}

		const token = getJwt(user.id, hash);

		if (!token) {
			return res.status(400).json({ msg: 'Invalid credentials' });
		}

		// get friendships
		const friendships = await prisma.friendship.findMany({
			where: {
				userId: user.id,
			},
		});

		res.status(200).json({
			success: true,
			jwtToken: token,
			user: {
				id: user.id,
				name: user.name,
				username: user.username,
				email: user.email,
				emailVerified: user.emailVerified,
				bio: user.bio,
				profilePicture: user.profilePicture,
				friends: friendships,
				blockedWords: user.blockedWords,
			},
		});
	} catch (error) {
		console.log('error logging in:', error);
		res
			.status(500)
			.json({ succcess: false, msg: 'unable to login at this time' });
	}
});

// @route POST auth/register
// @desc Register a new User
// @access Public
router.post('/register', async (req: Request, res: Response) => {
	const { username, password, email, name } = req.body;
	if (!username || !password || !email) {
		return res.status(400).json({ msg: 'Please enter all fields' });
	}

	if (!validateUsername(username)) {
		return res.status(400).json({ msg: 'Invalid username' });
	}

	if (!validatePassword(password)) {
		return res.status(400).json({ msg: 'Invalid password' });
	}

	if (!validateEmail(email)) {
		return res.status(400).json({ msg: 'Invalid email' });
	}
	try {
		// check if username already exists
		const usernameTaken = await prisma.user.findUnique({
			where: {
				username,
			},
		});

		if (usernameTaken) {
			return res
				.status(400)
				.json({ msg: 'User with that username already exists' });
		}

		// check if email is already in use
		const emailTaken = await prisma.user.findUnique({
			where: {
				email,
			},
		});

		if (emailTaken) {
			return res
				.status(400)
				.json({ msg: 'User with that email already exists' });
		}

		// hash password
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(password, salt);

		const newUser = await prisma.user.create({
			data: {
				username,
				name: name || username,
				email,
				password: hash,
				profilePicture: 'https://i.ibb.co/CnxM4Hj/grid-0-2.jpg',
			},
		});

		// sign jwt
		const token = getJwt(newUser.id, hash);

		if (!token) {
			return res.status(400).json({ msg: 'Error in creating jwt' });
		}

		res.json({
			user: {
				id: newUser.id,
				name: newUser.name,
				username: newUser.username,
				email: newUser.email,
			},
			token,
		});
	} catch (error) {
		console.log('error signing up:', error);
		res
			.status(500)
			.json({ succcess: false, msg: 'unable to create account at this time' });
	}
});

export default router;
