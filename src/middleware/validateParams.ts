import { Request, Response, NextFunction } from 'express';
import { Schema } from 'zod';

const validateParams = (schema: Schema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			schema.parse(req.body);
			next();
		} catch (error) {
			res
				.status(400)
				.json({ success: false, error: error, errorCode: 'MISSING_PARAMS' });
		}
	};
};

export default validateParams;
