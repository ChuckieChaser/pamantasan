// --- NOTIFICATION: EMAIL SERVICE ---
// Nodemailer transport wrapper. Consumes rendered HTML from templates/.
// No HTML or business logic lives here.

const nodemailer = require('nodemailer');
const { loadEnv } = require('../../shared/env');
const { renderOtpEmailHtml } = require('./templates/otpTemplate');
const { renderProvisionEmailHtml } = require('./templates/provisionTemplate');
const { renderNotificationEmailHtml } = require('./templates/notificationTemplate');

const PRODUCTION_LOGIN_URL = 'https://pamantasan-records-210fe.web.app/login';


// --- TRANSPORT ---

let transporter = null;

const getTransporter = () => {
    loadEnv();

    const senderEmail = (process.env.GMAIL_USER || '').replace(/['"]/g, '').trim();
    const appPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/['"]/g, '').replace(/\s+/g, '').trim();

    if (!senderEmail || !appPassword) {
        throw new Error(
            'Missing email configuration: GMAIL_USER and GMAIL_APP_PASSWORD must be defined in functions/.env',
        );
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: senderEmail, pass: appPassword },
        });
    }

    return transporter;
};

const getSenderAddress = () => {
    loadEnv();
    const name = (process.env.SENDER_NAME || 'Pamantasan Records').replace(/['"]/g, '').trim();
    const email = (process.env.GMAIL_USER || '').replace(/['"]/g, '').trim();
    return `"${name}" <${email}>`;
};


// --- PUBLIC API ---

/**
 * Sends a 6-digit OTP to the given institutional email for password recovery.
 */
const sendOtpEmail = async (toEmail, otpCode) => {
    const html = renderOtpEmailHtml(toEmail, otpCode);
    const subject = `[PLP Records] Password Reset Verification Code: ${otpCode}`;

    const transport = getTransporter();
    return transport.sendMail({ from: getSenderAddress(), to: toEmail, subject, html });
};

/**
 * Sends account provisioning credentials to a newly created user.
 */
const sendUserProvisionEmail = async ({ toEmail, recipientName, universityId, temporaryPassword, loginUrl }) => {
    const safeLoginUrl = (!loginUrl || loginUrl.includes('localhost') || loginUrl.includes('127.0.0.1'))
        ? PRODUCTION_LOGIN_URL
        : loginUrl;

    const html = renderProvisionEmailHtml({ recipientName, universityId, temporaryPassword, loginUrl: safeLoginUrl });
    const subject = `[PLP Records] Your Account Has Been Created - Official Login Credentials`;

    const transport = getTransporter();
    return transport.sendMail({ from: getSenderAddress(), to: toEmail, subject, html });
};

/**
 * Sends a generic system notification alert (document modified, coordinator request, etc.)
 */
const sendNotificationEmail = async ({ toEmail, recipientName, actorName, title, message, actionUrl, actionLabel }) => {
    const html = renderNotificationEmailHtml({ recipientName, actorName, title, message, actionUrl, actionLabel });
    const subject = `[PLP Records] ${title}`;

    const transport = getTransporter();
    return transport.sendMail({ from: getSenderAddress(), to: toEmail, subject, html });
};

module.exports = {
    sendOtpEmail,
    sendUserProvisionEmail,
    sendNotificationEmail,
};
