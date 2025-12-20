const BIRD_API_URL = 'https://api.bird.com/workspaces';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BIRD_API_KEY;
  const workspaceId = process.env.BIRD_WORKSPACE_ID;
  const channelId = process.env.BIRD_EMAIL_CHANNEL_ID;

  if (!apiKey || !workspaceId || !channelId) {
    console.error('Bird email credentials not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const url = `${BIRD_API_URL}/${workspaceId}/channels/${channelId}/messages`;
    console.log('Bird API request URL:', url);
    console.log('Bird API key prefix:', apiKey?.substring(0, 10) + '...');
    
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver: {
            contacts: [
              {
                identifierKey: 'emailaddress',
                identifierValue: options.to,
              },
            ],
          },
          body: {
            type: 'html',
            html: {
              html: options.htmlContent,
              text: options.textContent || options.htmlContent.replace(/<[^>]*>/g, ''),
              metadata: {
                subject: options.subject,
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bird email API error:', response.status, errorText);
      return { success: false, error: `Email sending failed: ${response.status}` };
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);
    return { success: true };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1a1a1a; margin-bottom: 24px; font-size: 24px;">Reset Your Password</h1>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          Hi ${userName},
        </p>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password for your Dine&More account. Click the button below to create a new password:
        </p>
        
        <a href="${resetLink}" style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
          Reset Password
        </a>
        
        <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 24px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0;">
        
        <p style="color: #999999; font-size: 12px; line-height: 1.6;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetLink}" style="color: #0066cc; word-break: break-all;">${resetLink}</a>
        </p>
      </div>
      
      <p style="color: #999999; font-size: 12px; text-align: center; margin-top: 24px;">
        &copy; ${new Date().getFullYear()} Dine&More. All rights reserved.
      </p>
    </body>
    </html>
  `;

  const textContent = `
Hi ${userName},

We received a request to reset your password for your Dine&More account.

Click here to reset your password: ${resetLink}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Dine&More. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Reset Your Dine&More Password',
    htmlContent,
    textContent,
  });
}

export async function sendAccountDeletionConfirmationEmail(
  email: string,
  confirmationLink: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #dc2626; margin-bottom: 24px; font-size: 24px;">Account Deletion Request</h1>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          Hi ${userName},
        </p>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to delete your Dine&More account. This action will permanently remove all your data including:
        </p>
        
        <ul style="color: #4a4a4a; font-size: 14px; line-height: 1.8; margin-bottom: 24px;">
          <li>Your profile information</li>
          <li>All loyalty points</li>
          <li>All vouchers (including unredeemed ones)</li>
          <li>Transaction history</li>
        </ul>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          <strong>This action cannot be undone.</strong> If you're sure you want to proceed, click the button below:
        </p>
        
        <a href="${confirmationLink}" style="display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
          Confirm Account Deletion
        </a>
        
        <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 24px;">
          This link will expire in 24 hours. If you didn't request to delete your account, you can safely ignore this email - your account will remain active.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0;">
        
        <p style="color: #999999; font-size: 12px; line-height: 1.6;">
          <strong>Data Retention Policy:</strong> After deletion, your anonymized data will be retained for 90 days for compliance purposes, after which it will be permanently removed from our systems.
        </p>
        
        <p style="color: #999999; font-size: 12px; line-height: 1.6; margin-top: 16px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${confirmationLink}" style="color: #dc2626; word-break: break-all;">${confirmationLink}</a>
        </p>
      </div>
      
      <p style="color: #999999; font-size: 12px; text-align: center; margin-top: 24px;">
        &copy; ${new Date().getFullYear()} Dine&More. All rights reserved.
      </p>
    </body>
    </html>
  `;

  const textContent = `
Hi ${userName},

We received a request to delete your Dine&More account.

This action will permanently remove all your data including:
- Your profile information
- All loyalty points
- All vouchers (including unredeemed ones)
- Transaction history

THIS ACTION CANNOT BE UNDONE.

Click here to confirm account deletion: ${confirmationLink}

This link will expire in 24 hours. If you didn't request to delete your account, you can safely ignore this email.

DATA RETENTION POLICY: After deletion, your anonymized data will be retained for 90 days for compliance purposes, after which it will be permanently removed.

© ${new Date().getFullYear()} Dine&More. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Confirm Your Dine&More Account Deletion',
    htmlContent,
    textContent,
  });
}
