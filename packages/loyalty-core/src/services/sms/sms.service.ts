const SMS_API_URL = 'https://rest.smsportal.com/v1/BulkMessages';

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
        messages: [
          {
            content: message,
            destination: phone.replace(/^\+/, '')
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
  const message = `Welcome to Fancy Frank's rewards, please use the link to register: ${registrationLink} Fancy Frank's Rewards`;
  return sendSMS(phone, message);
}

export async function sendPhoneChangeOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const message = `Your Dine&More verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`;
  return sendSMS(phone, message);
}
