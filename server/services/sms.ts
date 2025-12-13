const SMS_API_URL = 'https://rest.smsportal.com/BulkMessages';

export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SMS_CLIENT_ID;
  const apiSecret = process.env.SMS_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('SMS credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const apiCredentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_template: message,
        contacts: [
          {
            msisdn: phone,
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SMS API error:', response.status, errorText);
      return { success: false, error: `SMS sending failed: ${response.status}` };
    }

    const result = await response.json();
    console.log('SMS sent successfully:', result);
    return { success: true };
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

export async function sendRegistrationInvite(phone: string, restaurantName: string, registrationLink: string): Promise<{ success: boolean; error?: string }> {
  const message = `Welcome to ${restaurantName}! Join our rewards program and start earning points on every visit. Register here: ${registrationLink}`;
  return sendSMS(phone, message);
}
