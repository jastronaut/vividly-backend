import { Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import SendGrid from '@sendgrid/mail';

SendGrid.setApiKey(process.env.SENDGRID_API_KEY || '');

import { prisma } from '../../app';
import { auth } from '../../middleware/auth';
import {
	validateEmail,
	validatePassword,
	validateUsername,
	getJwt,
	generateVerificationCode,
} from '../../utils';
import { RequestUser } from '../../types/types';

const router = express.Router();

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
			include: {
				authUser: true,
			},
		});

		if (!user || !user.authUser) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		const hash = user.authUser.password;
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
				bio: user.bio,
				profilePicture: user.profilePicture,
				friends: friendships,
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
		const emailTaken = await prisma.authUser.findUnique({
			where: {
				email,
			},
		});

		if (emailTaken) {
			return res
				.status(400)
				.json({ msg: 'User with that email already exists' });
		}

		const code = generateVerificationCode();

		// hash password
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(password, salt);

		const newUser = await prisma.user.create({
			data: {
				username,
				name: name || username,
				profilePicture: 'https://i.ibb.co/CnxM4Hj/grid-0-2.jpg',
				authUser: {
					create: {
						password: hash,
						email,
						verificationCode: code,
					},
				},
			},
		});

		const message = {
			from: 'peached.app@gmail.com',
			to: email,
			subject: 'Verify your email',
			html: `<p>Use code ${code} to verify your email.</p>`,
		};

		await SendGrid.send(message);

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

// @route POST auth/password/change
// @desc Change a User's password
// @access Private
router.post('/password/change', auth, async (req: Request, res: Response) => {
	const { password, newPassword } = req.body;
	const user = req.user as RequestUser;
	if (!password || !newPassword) {
		return res.status(400).json({ msg: 'Please enter all fields' });
	}

	if (!validatePassword(newPassword)) {
		return res.status(400).json({ msg: 'Invalid password' });
	}

	try {
		if (!user) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		// hash password
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(newPassword, salt);

		const updatedUser = await prisma.user.update({
			where: {
				id: user.id,
			},

			data: {
				authUser: {
					update: {
						password: hash,
					},
				},
			},
		});

		// sign jwt
		const token = getJwt(updatedUser.id, hash);

		if (!token) {
			return res.status(400).json({ msg: 'Error in creating jwt' });
		}

		res.json({
			user: {
				id: updatedUser.id,
				name: updatedUser.name,
				username: updatedUser.username,
			},
			token,
		});

		res.status(200).json({ msg: 'Password changed successfully' });
	} catch (error) {
		console.log('error changing password:', error);
		res
			.status(500)
			.json({ succcess: false, msg: 'unable to change password at this time' });
	}
});

// @route GET auth/verify
// @desc Send verification email to user
// @access Private
router.get('/verify', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	if (!user) {
		return res.status(400).json({ msg: 'User does not exist' });
	}

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				userId: user.id,
			},
		});

		if (!authUser) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		if (authUser.emailVerified) {
			return res.status(400).json({ msg: 'Email already verified' });
		}

		const message = {
			from: 'peached.app@gmail.com',
			to: authUser.email,
			subject: 'Verify your email',
			html: `<p>Click <a href="http://localhost:3000/verify/${user.id}">here</a> to verify your email</p>`,
		};

		await SendGrid.send(message);

		res.status(200).json({ msg: 'Email sent successfully' });
	} catch (error) {
		console.log('error sending email:', error);
		res.status(500).json({ msg: 'Error sending email' });
	}
});

// @route GET auth/verify/:code
// @desc Verify user via code
// @access Public
router.get('/verify/:code', auth, async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const { code } = req.params;

	if (!user) {
		return res.status(400).json({ msg: 'User does not exist' });
	}

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				userId: user.id,
			},

			include: {
				user: true,
			},
		});

		if (!authUser) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		if (authUser.emailVerified) {
			return res.status(400).json({ msg: 'Email already verified' });
		}

		if (authUser.verificationCode !== code) {
			return res.status(400).json({ msg: 'Invalid code' });
		}

		await prisma.authUser.update({
			where: {
				userId: user.id,
			},

			data: {
				emailVerified: true,
			},
		});

		res.status(200).json({ msg: 'Email verified successfully' });
	} catch (error) {
		console.log('error verifying email:', error);
		res.status(500).json({ msg: 'Error verifying email' });
	}
});

export default router;
