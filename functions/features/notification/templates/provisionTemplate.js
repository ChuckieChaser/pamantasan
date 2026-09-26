// --- PROVISION EMAIL TEMPLATE ---

/**
 * Renders the HTML body for an account provisioning email.
 * @param {Object} params
 * @param {string} params.recipientName - Full name of the new user.
 * @param {string} params.universityId - Assigned university ID.
 * @param {string} params.temporaryPassword - Generated temporary password.
 * @param {string} params.loginUrl - Login portal URL.
 * @returns {string} Rendered HTML string.
 */
const renderProvisionEmailHtml = ({ recipientName, universityId, temporaryPassword, loginUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Created - Official Credentials</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        .email-wrapper { width: 100%; background-color: #f4f4f5; padding: 40px 16px; }
        .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); }
        .header-banner { background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); padding: 32px 32px 28px 32px; text-align: center; border-bottom: 3px solid #10b981; }
        .institution-name { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: 700; color: #ecfdf5; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 4px 0; }
        .institution-sub { font-size: 11px; font-weight: 600; color: #a7f3d0; letter-spacing: 1.5px; text-transform: uppercase; margin: 0; }
        .content-area { padding: 36px 32px 28px 32px; text-align: left; }
        .icon-badge { width: 44px; height: 44px; border-radius: 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin: 0 0 18px 0; text-align: center; line-height: 44px; font-size: 20px; display: inline-block; }
        .heading { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px 0; letter-spacing: -0.2px; }
        .subheading { font-size: 13px; color: #71717a; margin: 0 0 24px 0; line-height: 1.5; }
        .greeting-text { font-size: 14px; color: #27272a; line-height: 1.6; margin: 0 0 20px 0; }
        .credential-box { background-color: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 20px 22px; margin: 0 0 24px 0; }
        .credential-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #047857; }
        .credential-value { font-family: 'Inter', -apple-system, monospace; font-size: 15px; font-weight: 700; color: #064e3b; }
        .button-wrapper { text-align: center; margin: 24px 0 16px 0; }
        .btn { display: inline-block; background-color: #059669; color: #ffffff !important; padding: 13px 32px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px; }
        .link-fallback { font-size: 11px; color: #71717a; text-align: center; margin: 0 0 24px 0; word-break: break-all; }
        .url-text { color: #059669; text-decoration: underline; }
        .warning-box { background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; margin: 0 0 24px 0; }
        .warning-text { font-size: 12px; color: #92400e; margin: 0; line-height: 1.55; }
        .advisory-text { font-size: 12px; color: #71717a; line-height: 1.55; margin: 0; }
        .footer { background-color: #fafafa; border-top: 1px solid #e4e4e7; padding: 22px 32px; text-align: center; }
        .footer-brand { font-size: 12px; font-weight: 600; color: #3f3f46; margin-bottom: 4px; }
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
                <div class="icon-badge">🎓</div>
                <h1 class="heading">Account Created</h1>
                <p class="subheading">Official Credentials &amp; Account Provisioning</p>

                <p class="greeting-text">
                    Hello <strong>${recipientName || 'there'}</strong>,<br><br>
                    Your official account for the Pamantasan Records Management System has been provisioned. You can access the portal using your institutional credentials below:
                </p>

                <div class="credential-box">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="padding: 6px 0 10px 0; border-bottom: 1px solid #d1fae5;">
                                <span class="credential-label">UNIVERSITY ID</span>
                            </td>
                            <td style="padding: 6px 0 10px 0; border-bottom: 1px solid #d1fae5; text-align: right;">
                                <span class="credential-value">${universityId}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0 6px 0;">
                                <span class="credential-label">TEMPORARY PASSWORD</span>
                            </td>
                            <td style="padding: 10px 0 6px 0; text-align: right;">
                                <span class="credential-value">${temporaryPassword}</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="button-wrapper">
                    <a href="${loginUrl}" class="btn">Log In to Pamantasan Records</a>
                </div>
                <p class="link-fallback">
                    Or navigate to: <a href="${loginUrl}" class="url-text">${loginUrl}</a>
                </p>

                <div class="warning-box">
                    <p class="warning-text">
                        <strong>First-Time Login Required:</strong> Upon logging in for the first time, you will be able to change your password and link your institutional Google account for Single Sign-On (SSO).
                    </p>
                </div>

                <p class="advisory-text">
                    If you have questions regarding this provisioned account, please contact the Pamantasan Records Management Office.
                </p>
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

module.exports = { renderProvisionEmailHtml };
