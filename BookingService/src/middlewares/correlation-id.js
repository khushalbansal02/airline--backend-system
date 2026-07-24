const { randomUUID } = require('crypto');

/**
 * Correlation-ID middleware (JOURNAL 2.4).
 *
 * Distributed tracing starts here: honor an incoming X-Correlation-Id (so a
 * request that already flowed through the gateway keeps its id) or mint a new
 * one. We attach it to the request and echo it on the response. The saga then
 * forwards it on outgoing calls, so ONE id ties together every log line across
 * booking -> flight -> auth for a single user action.
 */
module.exports = function correlationId(req, res, next) {
  const id = req.headers['x-correlation-id'] || randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
};
