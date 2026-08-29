// Vercel serverless function — server-side Turnstile token verification.
// Route: POST /api/verify-turnstile
//
// The Cloudflare Pages Function (functions/api/verify-turnstile.js) is the
// original, but the site is deployed on Vercel, which does not run
// functions/* — without this file the human gate's POST returned 404 and
// on-chain play was locked forever. Same verification, same env var.
//
// Secret key: TURNSTILE_SECRET_KEY (server-only). Site key: VITE_TURNSTILE_SITE_KEY.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method not allowed' });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ success: false, error: 'TURNSTILE_SECRET_KEY not configured' });
  }

  let token;
  try {
    ({ token } = req.body ?? {});
  } catch {
    return res.status(400).json({ success: false, error: 'invalid body' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'missing token' });
  }

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('remoteip', req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '');

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const out = await resp.json();
  return res.status(out.success ? 200 : 400).json(out);
}
