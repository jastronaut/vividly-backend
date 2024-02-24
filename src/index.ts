import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import AuthHandlers from './routes/v0/auth';
import PostHandlers from './routes/v0/posts/posts';
import FeedHandlers from './routes/v0/feed';
import FriendHandlers from './routes/v0/friends';
import BlockedUsersHandlers from './routes/v0/blocked_users';
import UsersHandlers from './routes/v0/users';
import WaitlistHandlers from './routes/v0/waitlist';
import NotificationHandlers from './routes/v0/notifications';
import ReportHandlers from './routes/v0/reports';
import AdminHandlers from './routes/v0/admin';

import './cronJobs';

const app = express();

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 300,
});
app.use(limiter);

const VALID_ORIGINS = [
	'https://vividly-web.vercel.app',
	'https://app.vividly.love',
];

if (process.env.NODE_ENV === 'development') {
	VALID_ORIGINS.push('http://localhost:3000');
}

app.use(express.json());
// questionable
app.use(
	cors({
		origin: (origin: string | undefined, callback: Function) => {
			// i do not like this at all :)
			if (
				origin === undefined ||
				(origin && VALID_ORIGINS.indexOf(origin) !== -1)
			) {
				callback(null, true);
			} else {
				callback(new Error('Not allowed by CORS'));
			}
		},
	})
);

app.use('/v0/auth', AuthHandlers);
app.use('/v0/posts', PostHandlers);
app.use('/v0/feed', FeedHandlers);
app.use('/v0/friends', FriendHandlers);
app.use('/v0/blocked_users', BlockedUsersHandlers);
app.use('/v0/users', UsersHandlers);
app.use('/v0/waitlist', WaitlistHandlers);
app.use('/v0/notifications', NotificationHandlers);
app.use('/v0/reports', ReportHandlers);
app.use('/v0/admin', AdminHandlers);

const port = process.env.PORT || 1337;

app.listen(port, () =>
	console.log(
		`⭐️ You're running Vividly! Server is listening on port ${port} ⭐️`
	)
);
