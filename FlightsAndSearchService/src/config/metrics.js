const client = require('prom-client');

/**
 * Prometheus metrics for the flight service (JOURNAL 3.2).
 * Also exposes a cache hit/miss counter so the dashboard can show cache
 * effectiveness (hit ratio) alongside request latency.
 */
const register = new client.Registry();
register.setDefaultLabels({ service: 'flights' });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const cacheEvents = new client.Counter({
  name: 'flight_search_cache_events_total',
  help: 'Flight search cache events',
  labelNames: ['result'], // 'hit' | 'miss'
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}

module.exports = { register, metricsMiddleware, cacheEvents, client };
