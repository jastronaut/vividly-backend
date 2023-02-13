import express from 'express';

import AuthHandlers from './routes/v0/auth';
import PostHandlers from './routes/v0/posts';

const app = express();
app.use(express.json());

app.use('/v0/auth', AuthHandlers);
app.use('/v0/posts', PostHandlers);

const port = process.env.PORT || 1337;

const server = app.listen(port, () =>
	console.log(
		`⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`
	)
);
