package email

import "fmt"

// OTPVerificationHTML returns the HTML body for the email verification message
// sent immediately after a tenant registers. The OTP expires in 15 minutes.
func OTPVerificationHTML(name, otp string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e0e0e0;">

        <!-- Header -->
        <tr>
          <td style="background:#0D0D0D;padding:22px 32px;">
            <span style="font-family:monospace;font-size:22px;font-weight:bold;color:#FFCD32;letter-spacing:0.06em;">KANALL</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 12px;font-size:16px;color:#111111;font-weight:600;">Hi %s,</p>
            <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.65;">
              Enter this code to verify your email and activate your Kanall account.
              It expires in <strong>15 minutes</strong>.
            </p>

            <!-- OTP block -->
            <div style="text-align:center;margin-bottom:28px;">
              <div style="display:inline-block;background:#0D0D0D;padding:20px 36px;border-radius:2px;">
                <span style="font-family:monospace;font-size:36px;font-weight:bold;color:#FFCD32;letter-spacing:0.25em;">%s</span>
              </div>
            </div>

            <!-- Security note -->
            <p style="margin:0 0 8px;font-size:12px;color:#999999;line-height:1.6;">
              If you did not create a Kanall account, you can safely ignore this email.
              Do not share this code with anyone.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:10px;font-family:monospace;color:#bbbbbb;letter-spacing:0.12em;">
              KANALL · POWERED BY NOMBA · TEAM PRÓTOS
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`, name, otp)
}
