// Live updates: every open MonEXP page keeps a WebSocket to /api/live. After a change,
// the server tells all of that user's other pages (other tabs, phone, laptop) to reload.
// Only "something changed" is sent – the pages fetch the new figures through the normal API.
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { config } from '../config.js';
import { SESSION_COOKIE } from '../middleware/auth.js';
import { User } from '../models/index.js';

export const LIVE_PATH = '/api/live';
/** Header each page sends with its requests, so it isn't told about its own changes. */
export const CLIENT_HEADER = 'x-monexp-client';
const PING_MS = 30_000; // keeps proxies from closing idle connections and finds dead ones

const pagesByUser = new Map(); // userId -> Set<WebSocket>

function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
  try {
    return jwt.verify(cookies[SESSION_COOKIE] || '', config.jwtSecret).sub;
  } catch {
    return null;
  }
}

// Only pages served from this same site may connect (stops other websites using your login cookie).
function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function reject(socket, status, text) {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Lets the HTTP server accept signed-in pages on /api/live. */
export function attachLive(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== LIVE_PATH) return reject(socket, 404, 'Not Found');
    if (!sameSite(req)) return reject(socket, 403, 'Forbidden');
    const userId = readSession(req);
    if (!userId) return reject(socket, 401, 'Unauthorized');
    User.exists({ _id: userId }).catch(() => null).then((exists) => {
      if (!exists) return reject(socket, 401, 'Unauthorized'); // a deleted login
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.userId = userId;
        ws.alive = true;
        if (!pagesByUser.has(userId)) pagesByUser.set(userId, new Set());
        pagesByUser.get(userId).add(ws);
        ws.on('pong', () => { ws.alive = true; });
        ws.on('message', () => {}); // pages don't send anything
        ws.on('close', () => {
          const pages = pagesByUser.get(userId);
          pages?.delete(ws);
          if (pages && !pages.size) pagesByUser.delete(userId);
        });
      });
    });
  });

  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, PING_MS);
  wss.on('close', () => clearInterval(timer));
  server.on('close', () => wss.close());
  return wss;
}

/** True while `userId` has MonEXP open somewhere (any tab or device) – the Admin page's green dot. */
export const isOnline = (userId) => Boolean(pagesByUser.get(String(userId))?.size);

/** Tells every open page of `userId` that their data changed. `from` = the page that made the change. */
export function notifyChanged(userId, from) {
  const pages = pagesByUser.get(String(userId));
  if (!pages) return;
  const message = JSON.stringify({ type: 'changed', from: from || null });
  for (const ws of pages) if (ws.readyState === ws.OPEN) ws.send(message);
}

/** A deleted login: its open pages reload (and find they're signed out), then the connections close. */
export function disconnectUser(userId) {
  const pages = pagesByUser.get(String(userId));
  if (!pages) return;
  for (const ws of pages) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'changed', from: null }));
    ws.close();
  }
  pagesByUser.delete(String(userId));
}

/** Express middleware: after a successful change (not a read, not an AI question), notify the user's pages. */
export function notifyOnChange(req, res, next) {
  const isChange = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.originalUrl.startsWith('/api/ai/chat');
  if (isChange) {
    res.on('finish', () => {
      if (res.statusCode < 400) notifyChanged(req.userId, req.get(CLIENT_HEADER));
    });
  }
  next();
}
