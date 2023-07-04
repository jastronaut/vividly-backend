import express from 'express';
import cors from 'cors';

import AuthHandlers from './routes/v0/auth';
import PostHandlers from './routes/v0/posts';
import FeedHandlers from './routes/v0/feed';
import FriendHandlers from './routes/v0/friends';
import BlockedUsersHandlers from './routes/v0/blocked_users';
import UsersHandlers from './routes/v0/users';
import WaitlistHandlers from './routes/v0/waitlist';
import NotificationHandlers from './routes/v0/notifications';

const app = express();
app.use(express.json());
// questionable
app.use(cors());

app.use('/v0/auth', AuthHandlers);
app.use('/v0/posts', PostHandlers);
app.use('/v0/feed', FeedHandlers);
app.use('/v0/friends', FriendHandlers);
app.use('/v0/blocked_users', BlockedUsersHandlers);
app.use('/v0/users', UsersHandlers);
app.use('/v0/waitlist', WaitlistHandlers);
app.use('/v0/notifications', NotificationHandlers);

const port = process.env.PORT || 1337;

const server = app.listen(port, () =>
	console.log(
		`⭐️ You're running Vividly! Server is listening on port ${port} ⭐️`
	)
);
