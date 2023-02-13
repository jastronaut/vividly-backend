import { Request } from 'express';

import { Post } from '@prisma/client';
import { RequestUser } from '../types';

export {};

declare global {
	namespace Express {
		export interface Request {
			user?: RequestUser | null;
			post?: Post | null;
		}
	}
}
