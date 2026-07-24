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
