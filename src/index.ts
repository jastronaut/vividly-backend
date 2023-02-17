import express from 'express';

import AuthHandlers from './routes/v0/auth';
import PostHandlers from './routes/v0/posts';
import FeedHandlers from './routes/v0/feed';
import FriendHandlers from './routes/v0/friends';
import BlockedUsersHandlers from './routes/v0/blocked_users';

const app = express();
app.use(express.json());

app.use('/v0/auth', AuthHandlers);
app.use('/v0/posts', PostHandlers);
app.use('/v0/feed', FeedHandlers);
app.use('/v0/friends', FriendHandlers);
app.use('/v0/blocked_users', BlockedUsersHandlers);

const port = process.env.PORT || 1337;

const server = app.listen(port, () =>
	console.log(
		`⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`
	)
);
