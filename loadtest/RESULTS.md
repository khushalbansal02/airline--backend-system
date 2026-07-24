# Load Test Results — Seat Concurrency

**Test:** Fire 100 concurrent booking attempts at a flight with only **5 seats**, each booking requesting 1 seat. The invariant that must hold: *seats sold ≤ seats available, and the stored count never goes negative.*

Reproduce:
```bash
# start FlightsAndSearchService first (npm start), then:
node loadtest/seat-concurrency-test.js --mode=naive  --flight=1 --seats=5 --concurrency=100
node loadtest/seat-concurrency-test.js --mode=atomic --flight=1 --seats=5 --concurrency=100
```

## Before — naive read-modify-write (the bug)

```
Successful bookings : 100
Seats sold          : 100
Seats available     : 5
Final DB seat count : 3
RESULT: ❌ OVERSOLD (bug present)
```

100 bookings succeeded on a 5-seat flight. Each request read the seat count, then wrote `count − 1` in a separate call; concurrent requests all read the same value and clobbered each other's writes (**lost updates**). The airline just sold 100 seats it doesn't have.

## After — atomic conditional decrement (the fix)

```
Successful bookings : 5
Seats sold          : 5
Seats available     : 5
Final DB seat count : 0
RESULT: ✅ NO OVERSELLING (invariant held)
```

Exactly 5 bookings succeeded; the other 95 were correctly rejected with **HTTP 409 Conflict**. The reservation is a single atomic SQL statement:

```sql
UPDATE Flights SET totalSeats = totalSeats - :n
 WHERE id = :flightId AND totalSeats >= :n;
```

The `WHERE totalSeats >= :n` guard and the decrement happen indivisibly, so the database serializes concurrent writers and the invariant can never be violated.

> **Resume line:** *"Designed an atomic seat-reservation service; load-tested at 100 concurrent bookings on a 5-seat flight with zero overselling (vs. 95 oversold under the naive read-modify-write approach)."*

---

# Flight Search Benchmark — Redis cache-aside vs uncached

**Test:** 3,000 requests (concurrency 50) at `GET /flights?departureAirportId=1` against a realistic **5,003-flight** dataset, comparing the Redis cache-aside path to the uncached path (`?nocache=1`, always MySQL + ORM).

Reproduce:
```bash
mysql -u root -p flights_service_dev < loadtest/seed-bench-flights.sql   # seed ~5000 flights
node loadtest/search-benchmark.js --n=3000 --concurrency=50
mysql -u root -p -e "DELETE FROM flights_service_dev.Flights WHERE flightNumber LIKE 'BENCH%';"  # cleanup
```

| Path | mean | p50 | p95 | p99 |
|---|---|---|---|---|
| **Uncached** (MySQL + Sequelize) | 1528ms | 1523ms | 1678ms | 2583ms |
| **Cached** (Redis) | 380ms | 342ms | 470ms | 1967ms |
| **Speedup** | 4.0× | **4.5×** | **3.6×** | 1.3× |

The uncached path pays for a table scan **plus hydrating 5,000 Sequelize model objects** on every request; the cache serves the pre-serialized result and skips all of it. Invalidation is via a generation counter (`INCR flights:gen`) bumped on every flight write, so cached results are never stale after a booking changes seat counts.

> **Resume line:** *"Added a Redis cache-aside layer for flight search with generation-counter invalidation; cut p50 search latency 4.5× (1523ms → 342ms) on a 5k-flight dataset under 50 concurrent clients."*

> **Note / next step:** the absolute latencies are high because the endpoint returns all matching rows unpaginated — **pagination** is the natural companion optimization (cap page size, cache per page).
