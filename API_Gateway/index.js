const express = require('express');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

/**
 * API Gateway (JOURNAL 3.3) — the single front door.
 *
 * Responsibilities centralized here so individual services don't repeat them:
 *   - Routing: every service sits behind a clean prefix (/auth, /flights, /bookings)
 *   - AuthN: verify the JWT ONCE at the edge (no per-request round-trip to auth)
 *   - Identity propagation: forward the authenticated user id downstream (x-user-id)
 *   - Rate limiting: coarse per-IP globally, fine per-USER on protected routes
 *
 * NOTE: proxies are mounted at ROOT with a `pathFilter` (not app.use('/prefix')).
 * Mounting under a path makes Express strip that prefix before the proxy runs,
 * which breaks pathRewrite. Root + pathFilter keeps the full path intact.
 */
const PORT = process.env.PORT || 3006;
const JWT_KEY = process.env.JWT_KEY;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const FLIGHT_SERVICE_URL = process.env.FLIGHT_SERVICE_URL || 'http://localhost:3003';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:3002';

const app = express();
app.use(morgan('combined'));

// --- Coarse safety net: per-IP limit across everything ---
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Centralized JWT verification (verify locally with the shared secret) ---
function authenticate(req, res, next) {
  const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const token = req.headers['x-access-token'] || bearer;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_KEY);
    req.user = decoded; // { email, id, iat, exp }
    // Trusted identity for downstream services (they trust the gateway).
    req.headers['x-user-id'] = String(decoded.id);
    req.headers['x-user-email'] = decoded.email || '';
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// GET flight data is public; writes require auth.
function authenticateWrites(req, res, next) {
  if (req.method === 'GET') return next();
  return authenticate(req, res, next);
}

// --- Per-user limiter for protected routes (keyed by user id, not IP) ---
const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.USER_RATE_LIMIT_PER_MIN) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : req.ip),
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'gateway' }));

// --- Auth guards (path-scoped; they only read headers, so mount-strip is fine) ---
app.use('/flights', authenticateWrites);
app.use('/bookings', authenticate, perUserLimiter);

// --- Proxies (root-mounted + pathFilter so the full prefix survives) ---
// Public: auth. /auth/* -> /api/v1/*
app.use(
  createProxyMiddleware({
    pathFilter: (path) => path.startsWith('/auth'),
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/auth': '/api/v1' },
  })
);

// Flights: reads public, writes guarded above. /flights/* -> /api/v1/flights/*
app.use(
  createProxyMiddleware({
    pathFilter: (path) => path.startsWith('/flights'),
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/flights': '/api/v1/flights' },
  })
);

// Bookings: fully protected + per-user limited above. /bookings/* -> /api/v1/bookings/*
app.use(
  createProxyMiddleware({
    pathFilter: (path) => path.startsWith('/bookings'),
    target: BOOKING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/bookings': '/api/v1/bookings' },
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway started on port ${PORT}`);
});
