// src/utils/emailTemplates/verificationTemplate.js

export const emailTemplate = (user, verifyURL) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Email Verification</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f7;">
      <tr>
        <td align="center">
          <table width="100%" max-width="600px" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1); overflow:hidden;">
           
              <td style="padding: 30px; text-align:center; color:#333333;">
                <h2 style="margin-bottom: 10px;">Welcome, ${user.name} 👋</h2>
                <p style="font-size:16px; color:#555;">
                  Thanks for signing up! Please confirm your email address by clicking the button below:
                </p>
                <a href="${verifyURL}" 
                   style="display:inline-block; margin:20px 0; padding:14px 28px; background:#4CAF50; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; border-radius:6px;">
                  ✅ Verify Email
                </a>
                <p style="font-size:14px; color:#888; margin-top:20px;">
                  If the button doesn’t work, copy and paste this link in your browser:
                </p>
                <p style="word-break:break-all; font-size:13px; color:#4CAF50;">
                  ${verifyURL}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px; text-align:center; background:#f4f4f7; color:#999; font-size:12px;">
                © ${new Date().getFullYear()} Auth System. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};
