// --- CONCURRENCY OTP EMAIL TEMPLATE ---

/**
 * Renders the HTML body for account concurrency step-up OTP verification.
 * @param {string} toEmail - Recipient institutional email.
 * @param {string} otpCode - 6-digit OTP code to authorize session takeover.
 * @param {string} ipAddress - Client IP of the login attempt.
 * @param {string} userAgent - Browser / device agent string.
 * @returns {string} Rendered HTML string.
 */
const renderConcurrencyEmailHtml = (toEmail, otpCode, ipAddress = 'Unknown IP', userAgent = 'Unknown Device') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Active Account Login Verification</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        .email-wrapper { width: 100%; background-color: #f4f4f5; padding: 40px 16px; }
        .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); }
        .header-banner { background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); padding: 32px 32px 28px 32px; text-align: center; border-bottom: 3px solid #10b981; }
        .institution-name { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: 700; color: #ecfdf5; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 4px 0; }
        .institution-sub { font-size: 11px; font-weight: 600; color: #a7f3d0; letter-spacing: 1.5px; text-transform: uppercase; margin: 0; }
        .content-area { padding: 36px 32px 28px 32px; text-align: left; }
        .icon-badge { width: 44px; height: 44px; border-radius: 12px; background-color: #fef3c7; border: 1px solid #fde68a; margin: 0 0 18px 0; text-align: center; line-height: 44px; font-size: 20px; display: inline-block; }
        .heading { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px 0; letter-spacing: -0.2px; }
        .subheading { font-size: 13px; color: #71717a; margin: 0 0 24px 0; line-height: 1.5; }
        .greeting-text { font-size: 14px; color: #27272a; line-height: 1.6; margin: 0 0 20px 0; }
        .email-highlight { color: #047857; font-weight: 600; }
        .device-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 0 0 24px 0; font-size: 12px; color: #475569; }
        .device-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .device-label { font-weight: 600; color: #64748b; }
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
            <div class="header-banner">
                <div class="institution-name">PAMANTASAN NG LUNGSOD NG PASIG</div>
                <div class="institution-sub">PAMANTASAN RECORDS</div>
            </div>

            <div class="content-area">
                <div class="icon-badge">⚠️</div>
                <h1 class="heading">Concurrent Login Alert</h1>
                <p class="subheading">Active Session Transfer Verification</p>

                <p class="greeting-text">
                    Hello,<br><br>
                    A new sign-in attempt was detected for your account (<span class="email-highlight">${toEmail}</span>). Your account is currently signed in on another device.
                </p>

                <div class="device-card">
                    <div style="margin-bottom: 6px;"><strong>Incoming Device Request:</strong></div>
                    <div style="font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">
                        IP Address: ${ipAddress}<br>
                        Client: ${userAgent}
                    </div>
                </div>

                <p class="greeting-text" style="font-size: 13px;">
                    To authorize signing into this new device and <strong>actively log out your previous session</strong>, enter the verification code below:
                </p>

                <div class="otp-container">
                    <div class="otp-title">Session Transfer Code</div>
                    <div class="otp-number">${otpCode}</div>
                    <div class="otp-pill">⏱ Valid for 10 minutes</div>
                </div>

                <div class="warning-box">
                    <p class="warning-text">
                        <strong>Security Notice:</strong> Entering this code will immediately invalidate all active sessions on your other devices. If you did not attempt to sign in, do not share this code and change your password immediately.
                    </p>
                </div>

                <p class="advisory-text">
                    This security layer ensures that your institutional account is only active on one authorized device at any given time.
                </p>
            </div>

            <div class="footer">
                <div class="footer-brand">Pamantasan ng Lungsod ng Pasig • Records Management Office</div>
                <p class="footer-sub">
                    Alkalde Jose St., Kapasigan, Pasig, Metro Manila<br>
                    © 2026 Pamantasan Records. Electronic Document Management System.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;

module.exports = { renderConcurrencyEmailHtml };
