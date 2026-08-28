// Cloudflare Pages Function — server-side Turnstile token verification.
// Route: POST /api/verify-turnstile  (from functions/api/verify-turnstile.js)
// The secret key lives in a Pages env var (TURNSTILE_SECRET_KEY) and never
// reaches the client; the public site key is embedded in the client bundle.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return json({ success: false, error: 'TURNSTILE_SECRET_KEY not configured' }, 500);
  }

  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return json({ success: false, error: 'invalid body' }, 400);
  }
  if (!token || typeof token !== 'string') {
    return json({ success: false, error: 'missing token' }, 400);
  }

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  form.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const out = await res.json();
  return json(out, out.success ? 200 : 400);
}
