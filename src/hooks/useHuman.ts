import { useCallback, useState } from 'react';

/**
 * Cloudflare Turnstile human-verification gate.
 * The token is checked server-side by a Cloudflare Pages Function
 * (functions/api/verify-turnstile.js) so bots can't just spoof it.
 */
export function useHuman() {
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (token: string) => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setVerified(true);
      } else {
        setError('Human check failed — please try again.');
      }
    } catch {
      setError('Could not reach the verification service. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setVerified(false);
    setError(null);
  }, []);

  return { verified, verifying, error, verify, reset };
}
