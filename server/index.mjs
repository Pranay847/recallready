import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { analyzeCase } from './domain.mjs';
import { importCsv } from './csv.mjs';
import { createDemoCase } from './demo.mjs';
import { extractNotice, extractInventory, DEFAULT_MODEL } from './ai.mjs';
import { extractPdfText } from './pdf.mjs';
import { hostingConfig, createHostingGuard, applySecurityHeaders } from './hosting.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const MAX_JSON_BYTES = 12 * 1024 * 1024;

const MIME = {
  '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function statusError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

async function readJson(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw statusError('Content-Type must be application/json', 415);
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) tooLarge = true;
    else chunks.push(chunk);
  }
  if (tooLarge) throw statusError('Request body exceeds the 12 MB limit', 413);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw statusError('Request body must contain valid JSON');
  }
}

const loopbackNames = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = String(request.headers.host || '').split(':')[0].toLocaleLowerCase('en-US');
    return parsed.host === request.headers.host || (loopbackNames.has(parsed.hostname) && loopbackNames.has(host));
  } catch {
    return false;
  }
}

function safePath(root, relative) {
  let decoded;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = path.resolve(root, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  const prefix = `${path.resolve(root)}${path.sep}`;
  return target === path.resolve(root) || target.startsWith(prefix) ? target : null;
}

async function tryStatic(request, response, pathname, { distDir, publicDir }) {
  const sample = pathname.startsWith('/samples/');
  const root = sample ? publicDir : distDir;
  const relative = sample ? pathname : (pathname === '/' ? '/index.html' : pathname);
  let target = safePath(root, relative);
  if (!target) throw statusError('Invalid path', 400);
  let fileStat;
  try {
    fileStat = await stat(target);
  } catch {
    if (!sample && !path.extname(pathname)) {
      target = safePath(root, '/index.html');
      try { fileStat = await stat(target); } catch { return false; }
    } else return false;
  }
  if (!fileStat.isFile()) return false;
  const body = await readFile(target);
  response.writeHead(200, {
    'content-type': MIME[path.extname(target).toLocaleLowerCase('en-US')] || 'application/octet-stream',
    'content-length': body.length,
    'x-content-type-options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
  return true;
}

export function createServer(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = hostingConfig(env);
  const guard = createHostingGuard(config, options.now);
  const staticOptions = {
    distDir: options.distDir || path.join(projectRoot, 'dist'),
    publicDir: options.publicDir || path.join(projectRoot, 'public'),
  };
  const server = http.createServer(async (request, response) => {
    applySecurityHeaders(response, config.hosted);
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      const pathname = url.pathname;
      guard.checkRequest(request, pathname);
      if (!config.hosted && pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method) && !isAllowedOrigin(request)) throw statusError('Request origin is not allowed', 403);
      if (request.method === 'GET' && pathname === '/api/health') {
        sendJson(response, 200, { aiConfigured: Boolean(env.NEBIUS_API_KEY?.trim()), model: env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL, ...(config.hosted ? { hosted: true, accessRequired: true } : {}) });
      } else if (request.method === 'POST' && pathname === '/api/access') {
        guard.authorize(request);
        sendJson(response, 200, { authorized: true });
      } else if (request.method === 'GET' && pathname === '/api/demo') {
        sendJson(response, 200, { case: createDemoCase() });
      } else if (request.method === 'POST' && pathname === '/api/analyze') {
        const body = await readJson(request);
        sendJson(response, 200, analyzeCase(body.case));
      } else if (request.method === 'POST' && pathname === '/api/import') {
        const body = await readJson(request);
        sendJson(response, 200, importCsv(body.kind, body.filename, body.text));
      } else if (request.method === 'POST' && pathname === '/api/document') {
        const body = await readJson(request);
        sendJson(response, 200, await extractPdfText(body));
      } else if (request.method === 'POST' && pathname === '/api/extract') {
        guard.authorize(request);
        const body = await readJson(request);
        if (!body || (body.kind !== undefined && !['notice', 'inventory'].includes(body.kind))) throw statusError('Extraction kind must be notice or inventory');
        const extract = body.kind === 'inventory' ? extractInventory : extractNotice;
        const release = guard.beginExtraction(body.text);
        try { sendJson(response, 200, await extract({ ...body, env, fetchImpl })); }
        finally { release(); }
      } else if (pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'API route not found' });
      } else if (['GET', 'HEAD'].includes(request.method) && await tryStatic(request, response, pathname, staticOptions)) {
        // Response sent by static handler.
      } else {
        sendJson(response, 404, { error: 'Not found' });
      }
    } catch (error) {
      if (!response.headersSent && error.retryAfter) response.setHeader('retry-after', String(error.retryAfter));
      if (!response.headersSent) sendJson(response, Number.isInteger(error.status) ? error.status : (error instanceof TypeError ? 400 : 500), { error: error.message || 'Request failed' });
      else response.end();
    }
  });
  server.requestTimeout = 45_000;
  server.headersTimeout = 10_000;
  return server;
}

function loadEnvironment() {
  const envFile = path.join(projectRoot, '.env');
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  loadEnvironment();
  const port = Number.parseInt(process.env.PORT || '4317', 10);
  const server = createServer();
  const host = process.env.RECALLREADY_HOSTED === 'true' ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, host, () => {
    console.log(`RecallReady listening on ${host}:${port}`);
  });
  const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000).unref(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
