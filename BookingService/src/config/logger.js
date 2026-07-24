const pino = require('pino');

/**
 * Structured JSON logger (JOURNAL 2.4).
 *
 * console.log produces unstructured text you can't query. A JSON logger emits
 * one object per line — searchable/filterable by field (level, service,
 * correlationId, ...) in any log aggregator (ELK, Loki, Datadog). In dev we
 * pretty-print; in prod we emit raw JSON.
 */
// Pretty-print only in interactive dev. In production emit raw JSON; in tests
// skip the transport (a worker thread) so Jest exits cleanly.
const usePretty = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  base: { service: 'booking' },
  transport: usePretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
});

module.exports = logger;
