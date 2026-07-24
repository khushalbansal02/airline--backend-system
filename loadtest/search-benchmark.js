/**
 * Flight-search latency benchmark — cached (Redis) vs uncached (JOURNAL 3.1).
 *
 * Fires N requests at the flight-search endpoint in each mode and reports
 * latency percentiles (p50/p95/p99). The cached path serves from Redis; the
 * uncached path (`?nocache=1`) always hits MySQL + the ORM.
 *
 * USAGE:  node loadtest/search-benchmark.js --n=2000 --concurrency=50
 * Requires FlightsAndSearchService (with Redis) running on :3003.
 */

const BASE = process.env.FLIGHT_SERVICE_PATH || 'http://localhost:3003';
const API = `${BASE}/api/v1`;

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : def;
}
const N = arg('n', 2000);
const CONCURRENCY = arg('concurrency', 50);
const QUERY = 'departureAirportId=1';

async function timeRequest(url) {
  const start = performance.now();
  const res = await fetch(url);
  await res.text(); // drain the body so we measure the full round-trip
  return performance.now() - start;
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    count: s.length,
    mean: mean.toFixed(2),
    p50: percentile(s, 50).toFixed(2),
    p95: percentile(s, 95).toFixed(2),
    p99: percentile(s, 99).toFixed(2),
    min: s[0].toFixed(2),
    max: s[s.length - 1].toFixed(2),
  };
}

// Run N requests with a bounded concurrency pool.
async function runPool(url, n, concurrency) {
  const samples = [];
  let i = 0;
  async function worker() {
    while (i < n) {
      i++;
      samples.push(await timeRequest(url));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return samples;
}

async function main() {
  const cachedUrl = `${API}/flights?${QUERY}`;
  const uncachedUrl = `${API}/flights?${QUERY}&nocache=1`;

  console.log(`\n=== Flight search benchmark (n=${N}, concurrency=${CONCURRENCY}) ===\n`);

  // Warm up each path (JIT + cache fill) before measuring.
  await runPool(cachedUrl, 50, 10);
  await runPool(uncachedUrl, 50, 10);

  const uncached = stats(await runPool(uncachedUrl, N, CONCURRENCY));
  const cached = stats(await runPool(cachedUrl, N, CONCURRENCY));

  const row = (label, s) =>
    `${label.padEnd(10)} mean=${s.mean}ms  p50=${s.p50}ms  p95=${s.p95}ms  p99=${s.p99}ms  min=${s.min}  max=${s.max}`;
  console.log(row('UNCACHED', uncached));
  console.log(row('CACHED', cached));

  const speedup = (Number(uncached.p95) / Number(cached.p95)).toFixed(1);
  const p50speedup = (Number(uncached.p50) / Number(cached.p50)).toFixed(1);
  console.log(`\nSpeedup: p50 ${p50speedup}x faster, p95 ${speedup}x faster with Redis cache-aside.\n`);
}

main().catch((e) => {
  console.error('Benchmark failed:', e.message);
  console.error('Is FlightsAndSearchService running on', BASE, 'with Redis up?');
  process.exit(1);
});
