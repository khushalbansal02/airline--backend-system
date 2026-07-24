const client = require('prom-client');

/**
 * Prometheus metrics (JOURNAL 3.2).
 *
 * The "metrics" pillar of observability: numeric time-series Prometheus scrapes
 * from GET /metrics. Logs tell you what happened in one request; metrics tell
 * you aggregate trends (rate, latency, error ratio) across all of them — the
 * basis for dashboards and alerts (SLIs/SLOs).
 */
const register = new client.Registry();
register.setDefaultLabels({ service: 'booking' });
client.collectDefaultMetrics({ register }); // process/CPU/memory/GC metrics

// RED method: Rate, Errors, Duration of HTTP requests.
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// Business metric: booking outcomes.
const bookingsTotal = new client.Counter({
  name: 'bookings_total',
  help: 'Total booking attempts by outcome',
  labelNames: ['outcome'], // 'success' | 'failure'
  registers: [register],
});

// Express middleware that times each request and records it by route+status.
function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}

module.exports = { register, metricsMiddleware, bookingsTotal, client };
