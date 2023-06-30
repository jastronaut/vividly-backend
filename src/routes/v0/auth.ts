import { Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import SendGrid from '@sendgrid/mail';
import { User } from '@prisma/client';

SendGrid.setApiKey(
	process.env.SENDGRID_DEV_API_KEY || process.env.SENDGRID_API_KEY || ''
);

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
		return res
			.status(400)
			.json({ success: false, error: 'Missing credentials' });
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
			return res
				.status(400)
				.json({ success: false, error: 'User does not exist' });
		}

		const hash = user.authUser.password;
		const match = await bcrypt.compare(password, hash);
		if (!match) {
			return res
				.status(400)
				.json({ success: false, error: 'Invalid credentials' });
		}

		const token = getJwt(user.id, hash);

		if (!token) {
			return res
				.status(400)
				.json({ success: false, error: 'Invalid credentials' });
		}

		res.status(200).json({
			success: true,
			token,
			user: {
				id: user.id,
				name: user.name,
				username: user.username,
				bio: user.bio,
				avatarSrc: user.avatarSrc,
			},
		});
	} catch (error) {
		console.log('error logging in:', error);
		res
			.status(500)
			.json({ succcess: false, error: 'unable to login at this time' });
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

	let newUser: User | null = null;

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

		newUser = await prisma.user.create({
			data: {
				username,
				name: name || username,
				avatarSrc: 'https://i.ibb.co/CnxM4Hj/grid-0-2.jpg',
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
			from: { email: 'notify@vividly.love', name: 'Vividly' },
			to: {
				email,
				name: username,
			},
			subject: 'Verify your email',
			html: `<p>Click <a href="http://localhost:3000/verify/${newUser.id}/${code}">here</a> to verify your email</p>`,
			templateId: 'd-54260593ff0c4e6aa1503828726ddff2',
			dynamicTemplateData: {
				username: '@' + username,
				first_name: '@' + username,
				verify_url: `http://localhost:3000/verify/${newUser.id}/${code}`,
			},
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
				avatarSrc: newUser.avatarSrc,
				bio: '',
			},
			token,
		});
	} catch (error) {
		if (newUser) {
			await prisma.user.delete({
				where: {
					id: newUser.id,
				},
			});
		}
		console.log('error signing up:', error);
		// @ts-ignore
		if (error && error.response && error.response.body) {
			// @ts-ignore
			console.log(error.response.body);
		}
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

		const message = {
			from: { email: 'notify@vividly.love', name: 'Vividly' },
			to: { email: authUser.email, name: authUser.user.name },
			subject: 'Verify your email',
			html: `<p>Click <a href="http://localhost:3000/verify/${user.id}/${authUser.verificationCode}">here</a> to verify your email</p>`,
			templateId: 'd-54260593ff0c4e6aa1503828726ddff2',
			dynamicTemplateData: {
				username: '@' + authUser.user.username,
				first_name: '@' + authUser.user.username,
				verify_url: `http://localhost:3000/verify/${user.id}/${authUser.verificationCode}`,
			},
		};

		await SendGrid.send(message);

		res.status(200).json({ msg: 'Email sent successfully' });
	} catch (error) {
		console.log('error sending email:', error);
		res.status(500).json({ msg: 'Error sending email' });
	}
});

// @route GET auth/verify/:userId/:code
// @desc Verify user via code
// @access Public
router.get('/verify/:userId/:code', async (req: Request, res: Response) => {
	const { code } = req.params;
	const userId = parseInt(req.params.userId);

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				userId: userId,
			},
			include: {
				user: true,
			},
		});

		if (!authUser) {
			return res.status(400).json({
				error: 'User does not exist',
				errorCode: 'VERIFICATION_USER_DOES_NOT_EXIST',
			});
		}

		if (authUser.emailVerified) {
			return res.status(400).json({
				error: 'Email already verified',
				errorCode: 'VERIFICATION_EMAIL_ALREADY_VERIFIED',
			});
		}

		if (authUser.verificationCode !== code) {
			return res.status(400).json({
				error: 'Invalid code',
				errorCode: 'VERIFICATION_CODE_INVALID',
			});
		}

		await prisma.authUser.update({
			where: {
				userId,
			},
			data: {
				emailVerified: true,
				verificationCode: null,
			},
		});

		res.status(200).json({ msg: 'Email verified successfully', success: true });
	} catch (error) {
		console.log('error verifying email:', error);
		res.status(500).json({
			error: 'Error verifying email',
			errorCode: 'ERROR_VERIFYING_EMAIL',
		});
	}
});

// @route POST auth/password/reset
// @desc Send password reset email to user
// @access Public
router.post('/password/reset-request', async (req: Request, res: Response) => {
	const { email } = req.body;
	if (!email) {
		return res.status(400).json({ msg: 'Please enter all fields' });
	}

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				email,
			},
			include: {
				user: {
					select: {
						name: true,
						username: true,
					},
				},
			},
		});

		if (!authUser) {
			return res.status(400).json({ msg: 'User does not exist' });
		}

		const code = generateVerificationCode();

		await prisma.authUser.update({
			where: {
				email,
			},
			data: {
				resetCode: code,
			},
		});

		const passwordResetLink = `http://localhost:3000/password/reset/${authUser.userId}/${code}`;
		const message = {
			from: { email: 'notify@vividly.love', name: 'Vividly' },
			to: { email: authUser.email, name: authUser.user.name },
			subject: 'Verify your email',
			html: `<p>Click <a href="${passwordResetLink}">here</a> to reset your password</p>`,
			templateId: 'd-4e32a3a9281d460a95fef0f759f3736f',
			dynamicTemplateData: {
				username: '@' + authUser.user.username,
				first_name: '@' + authUser.user.username,
				verify_url: passwordResetLink,
			},
		};
		await SendGrid.send(message);
		res.status(200).json({ msg: 'Email sent successfully' });
	} catch (error) {
		console.log('error sending email:', error);
		res.status(500).json({ msg: 'Error sending email' });
	}
});

// @route POST auth/password/reset/:userId/:code
// @desc Reset user password
// @access Public
router.post(
	'/password/reset/:userId/:code',
	async (req: Request, res: Response) => {
		const { code } = req.params;
		const userId = parseInt(req.params.userId);
		const { password } = req.body;
		if (!password) {
			return res.status(400).json({ msg: 'Please enter all fields' });
		}

		if (!validatePassword(password)) {
			return res.status(400).json({ msg: 'Invalid password' });
		}

		try {
			const authUser = await prisma.authUser.findUnique({
				where: {
					userId,
				},
			});

			if (!authUser) {
				return res.status(400).json({ msg: 'User does not exist' });
			}

			if (authUser.resetCode !== code) {
				return res.status(400).json({ msg: 'Invalid code' });
			}

			const salt = await bcrypt.genSalt(10);
			const hash = await bcrypt.hash(password, salt);

			await prisma.authUser.update({
				where: {
					userId,
				},
				data: {
					password: hash,
					resetCode: null,
				},
			});

			res.status(200).json({ msg: 'Password reset successfully' });
		} catch (error) {
			console.log('error resetting password:', error);
			res.status(500).json({ msg: 'Error resetting password' });
		}
	}
);

// @route GET auth/info
// @desc Get user auth info
// @access Private
router.get('/info', auth, async (req: Request, res: Response) => {
	const user = req.user;

	if (!user) {
		return res.status(400).json({ msg: 'User does not exist' });
	}

	try {
		const authUser = await prisma.authUser.findUnique({
			where: {
				userId: user.id,
			},
			select: {
				email: true,
				emailVerified: true,
			},
		});

		if (!authUser) {
			return res
				.status(400)
				.json({
					success: false,
					error: 'User does not exist',
					errorCode: 'USER_DOES_NOT_EXIST',
				});
		}

		res.status(200).json({ authUser, success: true });
	} catch (error) {
		console.log('error getting auth info:', error);
		res
			.status(500)
			.json({
				success: false,
				error: 'Error getting auth info',
				errorCode: 'ERROR_GETTING_AUTH_INFO',
			});
	}
});

export default router;
