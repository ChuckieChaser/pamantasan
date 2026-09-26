// --- NOTIFICATION: CALLABLE HANDLERS ---

const { HttpsError } = require('firebase-functions/v2/https');
const { sendNotificationEmail } = require('./emailService');


/**
 * Dispatches a system notification email for document actions, coordinator requests, etc.
 */
const handleDispatchSystemNotification = async (data) => {
    const payload = data?.data ?? data ?? {};
    const { toEmail, recipientName, actorName, title, message, actionUrl, actionLabel } = payload;

    const cleanEmail = (toEmail || '').toString().trim().toLowerCase();
    if (!cleanEmail) {
        throw new HttpsError('invalid-argument', 'Recipient email address is required.');
    }

    if (!title || !message) {
        throw new HttpsError('invalid-argument', 'Notification title and message are required.');
    }

    try {
        await sendNotificationEmail({
            toEmail: cleanEmail,
            recipientName,
            actorName,
            title,
            message,
            actionUrl,
            actionLabel,
        });

        return {
            success: true,
            message: `Notification email dispatched to ${cleanEmail}.`,
        };
    } catch (error) {
        console.error('[handleDispatchSystemNotification] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to dispatch notification email.');
    }
};

module.exports = { handleDispatchSystemNotification };
