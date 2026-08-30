// Cloudflare Turnstile site key — PUBLIC by design (it is meant to be
// embedded in the client bundle and visible in the browser).
//
// Vercel refuses to save VITE_-prefixed env vars, so this lives in source.
// An optional build-time override via VITE_TURNSTILE_SITE_KEY still works for
// local/dev builds, but the committed value is the default.

export const TURNSTILE_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
  '0x4AAAAAAEh9D4oB-LdKRRbd';
