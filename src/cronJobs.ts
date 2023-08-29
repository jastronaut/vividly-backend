import cron from 'node-cron';
import { prisma } from './app';

const MAX_NOTIFICATIONS_AGE = 60;

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

// schedule task to be run once a week
cron.schedule('0 0 * * 0', () => {
	deleteOldNotifications()
		.then(() => console.log('Old notifications deleted.'))
		.catch(error => console.error('Error deleting notifications:', error));
});
