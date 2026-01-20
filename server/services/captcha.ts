import { Request, Response, NextFunction } from 'express';

// Use Cloudflare's always-pass test secret in development, real key in production
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.REPL_SLUG?.includes('prod');
const TURNSTILE_SECRET_KEY = isDevelopment 
  ? '1x0000000000000000000000000000000AA'  // Cloudflare test secret - always passes
  : (process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA');
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyCaptcha(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp,
      }),
    });

    const data: TurnstileResponse = await response.json();

    if (data.success) {
      return { success: true };
    }

    const errorCodes = data['error-codes'] || [];
    console.error('Captcha verification failed:', errorCodes);
    return { 
      success: false, 
      error: errorCodes.includes('timeout-or-duplicate') 
        ? 'Security check expired. Please try again.' 
        : 'Security verification failed. Please try again.' 
    };
  } catch (error) {
    console.error('Captcha verification error:', error);
    return { success: false, error: 'Security verification service unavailable.' };
  }
}

export function captchaMiddleware(req: Request, res: Response, next: NextFunction) {
  const captchaToken = req.body.captchaToken;
  
  if (!captchaToken) {
    return res.status(400).json({ error: 'Security verification required. Please complete the captcha.' });
  }

  const remoteIp = req.ip || req.socket.remoteAddress;
  
  verifyCaptcha(captchaToken, remoteIp)
    .then((result) => {
      if (result.success) {
        next();
      } else {
        return res.status(403).json({ error: result.error || 'Security verification failed.' });
      }
    })
    .catch((error) => {
      console.error('Captcha middleware error:', error);
      return res.status(500).json({ error: 'Security verification failed.' });
    });
}
