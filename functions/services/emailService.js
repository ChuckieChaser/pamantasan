// --- IMPORTS ---
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// --- ENVIRONMENT FALLBACK ---
function loadEnvFallback() {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        return;
    }
    const candidates = [
        path.resolve(__dirname, '../.env'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'functions/.env'),
    ];
    for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
            try {
                const content = fs.readFileSync(envPath, 'utf8');
                content.split(/\r?\n/).forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const eqIdx = trimmed.indexOf('=');
                        if (eqIdx !== -1) {
                            const key = trimmed.substring(0, eqIdx).trim();
                            let val = trimmed.substring(eqIdx + 1).trim();
                            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length - 1);
                            }
                            if (!process.env[key]) {
                                process.env[key] = val;
                            }
                        }
                    }
                });
                if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
                    break;
                }
            } catch {
                // Ignore filesystem read errors in restricted environments
            }
        }
    }
}

// Initial load attempt
loadEnvFallback();

// --- CONFIGURATION ---
let transporter = null;

function getTransporter() {
    loadEnvFallback();

    const senderEmail = (process.env.GMAIL_USER || '').replace(/["']/g, '').trim();
    const rawPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/["']/g, '').trim();
    // Google App Passwords are 16 letters; strip spaces if any exist
    const appPassword = rawPassword.replace(/\s+/g, '');

    if (!senderEmail || !appPassword) {
        throw new Error('Missing email configuration: GMAIL_USER and GMAIL_APP_PASSWORD must be defined in functions/.env');
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: senderEmail,
                pass: appPassword,
            },
        });
    }

    return transporter;
}

function getSenderAddress() {
    loadEnvFallback();
    const senderName = (process.env.SENDER_NAME || 'Pamantasan Records').replace(/["']/g, '').trim();
    const senderEmail = (process.env.GMAIL_USER || '').replace(/["']/g, '').trim();

    return `"${senderName}" <${senderEmail}>`;
}

/**
 * Sends a 6-digit OTP code for password reset.
 * Matches Pamantasan system design tokens: Fraunces serif, Inter sans, emerald-600 accents, zinc surfaces.
 */
async function sendOtpEmail(toEmail, otpCode) {
    const fromAddress = getSenderAddress();
    const subject = `[PLP Records] Password Reset Verification Code: ${otpCode}`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Verification Code</title>
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
            .greeting-text { font-size: 14px; color: #27272a; line-height: 1.6; margin: 0 0 24px 0; }
            .email-highlight { color: #047857; font-weight: 600; }
            .otp-container { background-color: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 24px 20px; text-align: center; margin: 0 0 24px 0; }
            .otp-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #047857; margin-bottom: 8px; }
            .otp-number { font-family: 'Inter', -apple-system, 'SF Pro Display', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #064e3b; margin: 6px 0 12px 0; padding-left: 10px; }
            .otp-pill { display: inline-block; background-color: #d1fae5; color: #065f46; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; }
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
                <!-- INSTITUTIONAL BRAND HEADER -->
                <div class="header-banner">
                    <div class="institution-name">PAMANTASAN NG LUNGSOD NG PASIG</div>
                    <div class="institution-sub">PAMANTASAN RECORDS</div>
                </div>

                <!-- MAIN CARD BODY -->
                <div class="content-area">
                    <div class="icon-badge">🔐</div>
                    <h1 class="heading">Password Reset Code</h1>
                    <p class="subheading">Official Account Security Verification</p>

                    <p class="greeting-text">
                        Hello,<br><br>
                        We received a request to reset the password for your institutional account (<span class="email-highlight">${toEmail}</span>). Enter the 6-digit verification code below to proceed:
                    </p>

                    <!-- OTP CREDENTIAL BOX -->
                    <div class="otp-container">
                        <div class="otp-title">Verification Code</div>
                        <div class="otp-number">${otpCode}</div>
                        <div class="otp-pill">⏱ Valid for 10 minutes</div>
                    </div>

                    <!-- SECURITY WARNING BOX -->
                    <div class="warning-box">
                        <p class="warning-text">
                            <strong>Security Advisory:</strong> Never share this verification code with anyone. Pamantasan administrative and IT personnel will never ask for your code or credentials.
                        </p>
                    </div>

                    <p class="advisory-text">
                        If you did not initiate this request, you can safely disregard this message. Your account credentials remain secure and unchanged.
                    </p>
                </div>

                <!-- INSTITUTIONAL FOOTER -->
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

    const transport = getTransporter();
    if (!transport) {
        console.log(`[SIMULATED EMAIL] To: ${toEmail} | Code: ${otpCode}`);
        return { simulated: true, code: otpCode };
    }

    return await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: subject,
        html: html,
    });
}

/**
 * Sends an extensible system notification alert (for document modifications, coordinator requests, etc.)
 * Matches Pamantasan system design tokens: Fraunces serif, Inter sans, emerald-600 accents, zinc surfaces.
 */
async function sendNotificationEmail({ toEmail, recipientName, actorName, title, message, actionUrl, actionLabel }) {
    const fromAddress = getSenderAddress();
    const subject = `[PLP Records] ${title}`;

    const html = `
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
                <!-- INSTITUTIONAL BRAND HEADER -->
                <div class="header-banner">
                    <div class="institution-name">PAMANTASAN NG LUNGSOD NG PASIG</div>
                    <div class="institution-sub">PAMANTASAN RECORDS</div>
                </div>

                <!-- MAIN CARD BODY -->
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

                <!-- INSTITUTIONAL FOOTER -->
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

    const transport = getTransporter();
    if (!transport) {
        console.log(`[SIMULATED NOTIFICATION] To: ${toEmail} | Title: ${title}`);
        return { simulated: true, title };
    }

    return await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: subject,
        html: html,
    });
}

/**
 * Sends an official account provisioning email with credentials and login URL.
 * Matches the forgot password OTP email design: Fraunces serif, Inter, emerald-600 accents, credential box.
 */
async function sendUserProvisionEmail({ toEmail, recipientName, universityId, temporaryPassword, loginUrl }) {
    const fromAddress = getSenderAddress();
    const cleanLoginUrl = (!loginUrl || loginUrl.includes('localhost') || loginUrl.includes('127.0.0.1'))
        ? 'https://pamantasan-records-210fe.web.app/login'
        : loginUrl;
    const subject = `[PLP Records] Your Account Has Been Created - Official Login Credentials`;

    const html = `
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
            .email-highlight { color: #047857; font-weight: 600; }
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
                <!-- INSTITUTIONAL BRAND HEADER -->
                <div class="header-banner">
                    <div class="institution-name">PAMANTASAN NG LUNGSOD NG PASIG</div>
                    <div class="institution-sub">PAMANTASAN RECORDS</div>
                </div>

                <!-- MAIN CARD BODY -->
                <div class="content-area">
                    <div class="icon-badge">🎓</div>
                    <h1 class="heading">Account Created</h1>
                    <p class="subheading">Official Credentials & Account Provisioning</p>

                    <p class="greeting-text">
                        Hello <strong>${recipientName || 'there'}</strong>,<br><br>
                        Your official account for the Pamantasan Records Management System has been provisioned. You can access the portal using your institutional credentials below:
                    </p>

                    <!-- CREDENTIALS CONTAINER -->
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

                    <!-- LOGIN ACTION BUTTON -->
                    <div class="button-wrapper">
                        <a href="${cleanLoginUrl}" class="btn">Log In to Pamantasan Records</a>
                    </div>
                    <p class="link-fallback">
                        Or navigate to: <a href="${cleanLoginUrl}" class="url-text">${cleanLoginUrl}</a>
                    </p>

                    <!-- FIRST-TIME LOGIN ADVISORY BOX -->
                    <div class="warning-box">
                        <p class="warning-text">
                            <strong>First-Time Login Required:</strong> Upon logging in for the first time, you will be able to change your password and link your institutional Google account for Single Sign-On (SSO).
                        </p>
                    </div>

                    <p class="advisory-text">
                        If you have questions regarding this provisioned account, please contact the Pamantasan Records Management Office.
                    </p>
                </div>

                <!-- INSTITUTIONAL FOOTER -->
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

    const transport = getTransporter();
    if (!transport) {
        console.log(`[SIMULATED PROVISION EMAIL] To: ${toEmail} | UniversityID: ${universityId}`);
        return { simulated: true, to: toEmail, universityId };
    }

    return await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: subject,
        html: html,
    });
}

module.exports = {
    sendOtpEmail,
    sendNotificationEmail,
    sendUserProvisionEmail,
};

