import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useCallback } from 'react';

interface CaptchaProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

export function Captcha({ onSuccess, onError, onExpire, className }: CaptchaProps) {
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleError = useCallback(() => {
    onError?.();
  }, [onError]);

  const handleExpire = useCallback(() => {
    onExpire?.();
    turnstileRef.current?.reset();
  }, [onExpire]);

  return (
    <div className={className}>
      <Turnstile
        ref={turnstileRef}
        siteKey={SITE_KEY}
        onSuccess={onSuccess}
        onError={handleError}
        onExpire={handleExpire}
        options={{
          theme: 'auto',
          size: 'flexible',
        }}
      />
    </div>
  );
}

export function useCaptchaReset() {
  const turnstileRef = useRef<TurnstileInstance>(null);
  
  const reset = useCallback(() => {
    turnstileRef.current?.reset();
  }, []);

  return { turnstileRef, reset };
}
