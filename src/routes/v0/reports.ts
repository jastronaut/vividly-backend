import { Request, Response } from 'express';
import express from 'express';

import { prisma } from '../../app';
import { RequestUser } from '../../types/types';
import { auth } from '../../middleware/auth';

const router = express.Router();

type ReportType = 'user' | 'comment' | 'post';
type ReportReason = 'Spam' | 'Inappropriate content' | 'Harassment' | 'Other';

// @route POST /v0/reports
// @desc Create a report
// @access Private
router.post('/', auth, async (req: Request, res: Response) => {
	try {
		const user = req.user as RequestUser;
		const { comment, itemId } = req.body;
		const itemType = req.body.itemType as ReportType;
		const reason = req.body.reason as ReportReason;

		if (!reason || !itemType || !itemId) {
			return res.status(400).json({
				success: false,
				error: 'Missing fields',
				errorCode: 'REPORT_INVALID_FIELDS',
			});
		}

		await prisma.report.create({
			data: {
				reason,
				itemType,
				comment,
				itemId,
				reporterId: user.id,
				createdTime: new Date(),
			},
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, error: err });
	}
});

export default router;
