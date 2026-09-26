// --- NOTIFICATION EMAIL TEMPLATE ---

/**
 * Renders the HTML body for a generic system notification email.
 * @param {Object} params
 * @param {string} params.recipientName - Recipient display name.
 * @param {string} [params.actorName] - Name of the actor who triggered the notification.
 * @param {string} params.title - Notification title.
 * @param {string} params.message - Notification body message.
 * @param {string} [params.actionUrl] - Optional CTA button URL.
 * @param {string} [params.actionLabel] - Optional CTA button label.
 * @returns {string} Rendered HTML string.
 */
const renderNotificationEmailHtml = ({
    recipientName,
    actorName,
    title,
    message,
    actionUrl,
    actionLabel,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        .email-wrapper { width: 100%; background-color: #f4f4f5; padding: 40px 16px; }
        .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); }
        .header-banner { background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); padding: 24px 32px; text-align: left; border-bottom: 3px solid #10b981; }
        .institution-name { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: 700; color: #ecfdf5; letter-spacing: 1.2px; text-transform: uppercase; margin: 0 0 2px 0; }
        .institution-sub { font-size: 11px; font-weight: 500; color: #a7f3d0; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
        .content-area { padding: 32px; text-align: left; }
        .greeting-text { font-size: 14px; color: #27272a; margin: 0 0 16px 0; }
        .notification-card { background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 0 0 24px 0; }
        .actor-badge { display: inline-block; font-size: 11px; padding: 3px 10px; border-radius: 6px; background-color: #ecfdf5; color: #047857; font-weight: 600; border: 1px solid #a7f3d0; margin-bottom: 12px; }
        .notification-title { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 8px; }
        .notification-message { font-size: 13px; color: #52525b; line-height: 1.6; margin: 0; }
        .button-wrapper { text-align: center; margin: 28px 0 12px 0; }
        .btn { display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 28px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px; }
        .footer { background-color: #fafafa; border-top: 1px solid #e4e4e7; padding: 20px 32px; text-align: center; }
        .footer-brand { font-size: 11px; font-weight: 600; color: #3f3f46; margin-bottom: 4px; }
        .footer-sub { font-size: 11px; color: #71717a; line-height: 1.5; margin: 0; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="card">
            <div class="header-banner">
                <div class="institution-name">PAMANTASAN NG LUNGSOD NG PASIG</div>
                <div class="institution-sub">PAMANTASAN RECORDS</div>
            </div>

            <div class="content-area">
                <p class="greeting-text">Hello <strong>${recipientName || 'there'}</strong>,</p>

                <div class="notification-card">
                    ${actorName ? `<div class="actor-badge">Action by ${actorName}</div>` : ''}
                    <div class="notification-title">${title}</div>
                    <p class="notification-message">${message}</p>
                </div>

                ${actionUrl ? `
                <div class="button-wrapper">
                    <a href="${actionUrl}" class="btn">${actionLabel || 'View in Pamantasan Records'}</a>
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <div class="footer-brand">Pamantasan ng Lungsod ng Pasig • Records Management Office</div>
                <p class="footer-sub">
                    Alkalde Jose St., Kapasigan, Pasig, Metro Manila<br>
                    © 2026 Pamantasan Records. AI-Assisted Document Management System.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;

module.exports = { renderNotificationEmailHtml };
