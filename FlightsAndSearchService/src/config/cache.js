require('dotenv').config();
const { createClient } = require('redis');
const crypto = require('crypto');

/**
 * Redis cache-aside layer for flight search (JOURNAL 3.1).
 *
 * Cache-aside (lazy loading): on read, check the cache; on a miss, read the DB
 * and populate the cache. On any write to flights, INVALIDATE.
 *
 * Invalidation strategy — generation counter:
 *   Every search key is namespaced by a generation number: flights:search:<hash>:v<gen>.
 *   To invalidate ALL search results at once we just INCR flights:gen — old keys
 *   become unreachable (and expire by TTL). This is O(1) and avoids scanning/
 *   deleting thousands of keys. It's the same idea as cache "versioning".
 *
 * The cache is a best-effort optimization: if Redis is down, every function
 * degrades to "no cache" and the service still serves from the DB.
 */
const TTL = Number(process.env.CACHE_TTL_SECONDS) || 30;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const GEN_KEY = 'flights:gen';

let client = null;
let ready = false;

async function getClient() {
  if (process.env.CACHE_ENABLED === 'false') return null;
  if (client && ready) return client;
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on('error', (e) => {
      ready = false;
      console.log('redis error:', e.message);
    });
    try {
      await client.connect();
      ready = true;
    } catch (e) {
      console.log('redis connect failed, serving without cache:', e.message);
      return null;
    }
  }
  return ready ? client : null;
}

function hashQuery(query) {
  const normalized = JSON.stringify(query || {});
  return crypto.createHash('md5').update(normalized).digest('hex');
}

async function currentGen(c) {
  const g = await c.get(GEN_KEY);
  return g ? Number(g) : 0;
}

async function getSearch(query) {
  const c = await getClient();
  if (!c) return null;
  try {
    const gen = await currentGen(c);
    const raw = await c.get(`flights:search:${hashQuery(query)}:v${gen}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function setSearch(query, data) {
  const c = await getClient();
  if (!c) return;
  try {
    const gen = await currentGen(c);
    await c.set(`flights:search:${hashQuery(query)}:v${gen}`, JSON.stringify(data), { EX: TTL });
  } catch (e) {
    /* best-effort */
  }
}

async function invalidateSearch() {
  const c = await getClient();
  if (!c) return;
  try {
    await c.incr(GEN_KEY); // bumps the generation -> all old search keys are dead
  } catch (e) {
    /* best-effort */
  }
}

module.exports = { getSearch, setSearch, invalidateSearch };
