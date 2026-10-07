import { createHash, timingSafeEqual } from 'node:crypto';

const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const fail = (message, status = 403) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(value).digest();

export function hostingConfig(env) {
  const hosted = env.RECALLREADY_HOSTED === 'true';
  if (!hosted) return { hosted: false };
  let url;
  try { url = new URL(env.PUBLIC_URL || env.RENDER_EXTERNAL_URL); } catch { throw new Error('Hosted mode requires PUBLIC_URL (or RENDER_EXTERNAL_URL).'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PUBLIC_URL must be an HTTPS origin without credentials, query, or path.');
  }
  const accessCode = env.DEMO_ACCESS_CODE?.trim() || '';
  if (env.NEBIUS_API_KEY?.trim() && accessCode.length < 16) throw new Error('Hosted live AI requires DEMO_ACCESS_CODE with at least 16 characters.');
  return { hosted: true, origin: url.origin, host: url.host, accessCode };
}

export function createHostingGuard(config, now = Date.now) {
  const windows = new Map();
  let activeExtractions = 0;
  function limit(name, count, duration) {
    const time = now();
    let window = windows.get(name);
    if (!window || time >= window.end) { window = { used: 0, end: time + duration }; windows.set(name, window); }
    if (window.used >= count) throw Object.assign(fail('The shared demo is busy. Please try again later; the sample drill is still available.', 429), { retryAfter: Math.max(1, Math.ceil((window.end - time) / 1000)) });
    window.used++;
  }
  return {
    checkRequest(request, pathname) {
      const host = String(request.headers.host || '').toLowerCase();
      if (!config.hosted) {
        if (!loopback.test(host)) throw fail('This workspace accepts local hostnames only');
        return;
      }
      if (host !== config.host && !(pathname === '/api/health' && loopback.test(host))) throw fail('Request hostname is not allowed');
      if (pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method)) {
        if (request.headers.origin && request.headers.origin !== config.origin) throw fail('Request origin is not allowed');
        limit('api', 240, 60_000);
      }
      if (pathname === '/api/document' && request.method === 'POST') limit('documents', 10, 60_000);
    },
    authorize(request) {
      if (!config.hosted) return;
      const supplied = request.headers['x-demo-access-code'];
      if (!config.accessCode || typeof supplied !== 'string' || supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(config.accessCode))) {
        throw fail('Open AI connection and enter the judge access code to use live extraction.', 401);
      }
    },
    beginExtraction(text) {
      if (!config.hosted) return () => {};
      if (typeof text === 'string' && text.length > 20_000) throw fail('For this shared demo, use a document under 20,000 characters.', 413);
      if (activeExtractions >= 2) throw Object.assign(fail('Two live extractions are already running. Please try again shortly.', 429), { retryAfter: 10 });
      limit('extraction', 20, 3_600_000);
      activeExtractions++;
      let released = false;
      return () => { if (!released) { activeExtractions--; released = true; } };
    },
  };
}

export function applySecurityHeaders(response, hosted) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (hosted) {
    response.setHeader('strict-transport-security', 'max-age=31536000');
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  }
}
