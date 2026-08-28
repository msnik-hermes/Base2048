import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: any;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/**
 * Renders a Cloudflare Turnstile widget and forwards the solved token to
 * onToken. The token is then verified server-side by a Pages Function.
 */
export function HumanGate({
  onToken,
  verifying,
  error,
}: {
  onToken: (token: string) => void;
  verifying: boolean;
  error: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY || !hostRef.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !hostRef.current) return;
      widgetRef.current = window.turnstile.render(hostRef.current, {
        sitekey: SITE_KEY,
        theme: 'dark',
        callback: (token: string) => onTokenRef.current(token),
      });
    };
    if (window.turnstile) {
      render();
    } else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch { /* noop */ }
        widgetRef.current = null;
      }
    };
  }, []);

  // if the server-side check rejected the token, reset the widget to retry
  useEffect(() => {
    if (error && widgetRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetRef.current);
      } catch { /* noop */ }
    }
  }, [error]);

  if (!SITE_KEY) {
    return (
      <p className="max-w-[280px] text-center text-[12px] leading-5 text-slate-500">
        Human check isn't configured yet — set <span className="font-mono text-cyan-bright">VITE_TURNSTILE_SITE_KEY</span>.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={hostRef} />
      {verifying && <p className="font-mono text-[11px] text-slate-400">Verifying…</p>}
      {error && <p className="max-w-[280px] text-center font-mono text-[11px] leading-5 text-rose">{error}</p>}
    </div>
  );
}
