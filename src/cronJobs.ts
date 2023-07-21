import cron from 'node-cron';
import { prisma } from './app';

const MAX_NOTIFICATIONS_AGE = 30;

async function deleteOldNotifications() {
	const dateThreshold = new Date();
	dateThreshold.setDate(dateThreshold.getDate() - MAX_NOTIFICATIONS_AGE);

	await prisma.notification.deleteMany({
		where: {
			createdTime: {
				lt: dateThreshold,
			},
		},
	});
}

// schedule task to be run every other day at 00:00
cron.schedule('0 0 */2 * *', () => {
	deleteOldNotifications()
		.then(() => console.log('Old notifications deleted.'))
		.catch(error => console.error('Error deleting notifications:', error));
});
