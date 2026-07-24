# Engineering Journal — Airline Booking System

> **Purpose of this document.** This is not a changelog. It's a record of the *engineering problems* we found in this system and how we reasoned about them. Every entry is written so that if an interviewer points at any part of this project and asks "why did you do it this way?", you can answer with the problem, the concept, the trade-off, and the fix.
>
> Read it top to bottom and you'll understand how real backend systems handle **consistency, concurrency, failure, and scale** — the exact things that separate a "vibe-coded CRUD app" from an engineer's project.

## How to use this doc for interviews

Each challenge follows the same five-part structure:

1. **Symptom** — what we observed / what was wrong.
2. **Why it matters** — the real-world impact (money lost, data corrupted, users angry).
3. **The concept** — the computer-science / system-design idea behind it. *This is what interviewers actually test.*
4. **The fix** — what we changed and why.
5. **Interview drill** — the questions you'll get, with answer sketches.

---

# Tier 0 — Correctness

> Before we can talk about "scale" or "distributed systems," the code has to be *correct*. Tier 0 is the unglamorous but essential layer: bugs that would fail a code review in the first five minutes. Getting these right is the difference between "below SDE1" and "solid SDE1."

## Challenge 0.1 — The event system was silently broken (exchange-name mismatch)

**Symptom.** BookingService publishes booking events to a RabbitMQ exchange named `airline_exchange` (from `BookingService/.env`), but ReminderService subscribes on an exchange named `airline` (from `ReminderService/.env`). They are two *different* exchanges. Every booking "succeeded," yet **no confirmation email was ever delivered**, and nothing errored — the message just vanished into an exchange nobody was listening to.

**Why it matters.** This is the most dangerous class of bug: a **silent failure**. There's no crash, no red log line. In production this looks like "sometimes customers don't get their tickets" — the kind of bug that takes days to trace because everything *appears* healthy. A distributed system is only as correct as the contracts between its parts, and a topic/exchange name *is* a contract.

**The concept — Message brokers & the publish/subscribe contract.**
- A **message broker** (RabbitMQ here) decouples the *producer* (BookingService) from the *consumer* (ReminderService). The producer doesn't call the consumer directly; it drops a message and moves on. This is how you get resilience (consumer can be down and catch up later) and scalability (add more consumers).
- In RabbitMQ the flow is: **Producer → Exchange → (routing/binding key) → Queue → Consumer.** The *exchange name* and the *binding key* are the address. If the producer and consumer disagree on either, the message is routed into the void.
- Our system also had the exchange declared as **non-durable** and messages as non-persistent — a second, related bug we fix in Tier 2 (a broker restart would drop all in-flight messages).

**The fix.** Standardized both services to the same exchange name and binding key via shared, validated config. A mismatch like this should be *impossible to introduce silently* — so config is now centralized and asserted at startup.

**Interview drill.**
- *Q: What's the difference between an exchange and a queue in RabbitMQ?* → An exchange receives messages from producers and routes them to queues based on binding keys and exchange type (direct/topic/fanout/headers). Consumers read from queues. Producers never write to queues directly.
- *Q: Why use a message queue instead of just calling the email service over HTTP?* → Decoupling and resilience: the booking succeeds even if the email service is down; the message waits in the queue. Also load-leveling (absorb spikes) and the ability to fan out one event to many consumers.
- *Q: How would you have caught this bug earlier?* → An integration/contract test that publishes and asserts the consumer received it; startup assertions that fail loudly on config mismatch; end-to-end tracing with correlation IDs.

## Challenge 0.2 — A database write that was never awaited (lost updates)

**Symptom.** In `FlightsAndSearchService/src/repository/flight-repository.js`, `updateFlight` called `Flights.update(...)` **without `await`**, then immediately `return true`. Sequelize's `update` returns a Promise; without awaiting it, the function reports success *before the database has confirmed the write* — and if the write fails, nobody ever finds out.

**Why it matters.** This is on the **seat-decrement path**. The booking service asks the flight service to reduce available seats. If that write silently fails but returns `true`, seats get "sold" in the booking DB but never deducted from inventory → **overselling**. Un-awaited async writes are a classic source of "works on my machine, corrupts data in production" bugs, because the race only shows up under load.

**The concept — Promises, the event loop, and "fire-and-forget" hazards.**
- Node.js is single-threaded with an **event loop**. Async I/O (DB calls, HTTP) returns a Promise immediately and completes later. `await` is what makes your function *wait* for the real result and *propagate errors*.
- A missing `await` = **fire-and-forget**: you lose both the result and the error. Errors become **unhandled promise rejections**, which can even crash the process on modern Node.
- Rule of thumb: every async call that has a side effect you depend on must be awaited (or explicitly, deliberately not — with a comment saying why).

**The fix.** Awaited the update and returned the actual affected-row count so callers can detect "updated 0 rows" (which itself signals a concurrency/existence problem).

**Interview drill.**
- *Q: What happens if you don't await a Promise in Node?* → The function continues before the operation finishes; the result is lost; a rejection becomes an unhandled rejection. No backpressure, no error handling.
- *Q: Node is single-threaded — how does it handle thousands of concurrent requests?* → Non-blocking I/O + the event loop. While one request waits on I/O, the loop serves others. CPU-bound work still blocks, which is why you offload it (worker threads, separate services).

## Challenge 0.3 — Silent `catch` blocks that swallow errors

**Symptom.** `BookingService/.../booking-repository.js`'s `updateBooking` had `catch(error){ }` — an empty catch. Any failure (DB down, row missing, constraint violation) was swallowed; the function returned `undefined` and the caller assumed success. Similar "log and continue" patterns existed elsewhere.

**Why it matters.** **Swallowing errors turns a loud, debuggable failure into a silent, undebuggable one.** The booking flow would commit a transaction believing the status update succeeded when it may not have. Error handling isn't about *hiding* errors — it's about *deciding* what to do with them (retry, compensate, propagate, alert).

**The concept — Error propagation & the "fail loud, fail fast" principle.**
- Errors should propagate to a layer that can *meaningfully handle* them. A repository can't decide the business response to "DB is down" — the service or controller can. So repositories should re-throw, not swallow.
- Distinguish **expected** errors (validation, "not found" → return a clean 4xx) from **unexpected** ones (bugs, outages → 5xx, alert, don't leak internals).

**The fix.** Empty catches now re-throw (or are removed so errors propagate naturally). A centralized error handler formats the client response.

**Interview drill.**
- *Q: When is it OK to catch and not re-throw?* → When *this* layer is the right place to handle it: you have a fallback, a compensating action, or you're translating a low-level error into a domain error. Never just to make a red line disappear.

## Challenge 0.4 — HTTP status codes that lie

**Symptom.** `FlightsAndSearchService/.../flight-controller.js`'s `getAll` returned **HTTP 500** on the *success* path. Other handlers returned 400/404/500 somewhat arbitrarily and stuffed raw error objects into responses.

**Why it matters.** Status codes are the **API's contract with every client, proxy, load balancer, and monitoring tool.** A `500` means "server broke" — it triggers alerts, retries, and circuit breakers. Returning 500 on success means your dashboards scream while everything's fine, and real failures hide in the noise. Clients (and the API Gateway) can't tell success from failure.

**The concept — HTTP semantics as a contract.**
- `2xx` success, `4xx` client's fault (don't retry blindly — fix the request), `5xx` server's fault (safe-ish to retry). Monitoring, retries, and caching all key off these.
- Also: never leak raw stack traces / DB errors to clients — that's an information-disclosure security issue *and* a bad contract.

**The fix.** Correct codes throughout: 200/201 success, 400 validation, 404 not found, 409 conflict (used later for concurrency), 500 only for genuine server faults. Standardized response envelope.

**Interview drill.**
- *Q: 401 vs 403?* → 401 = not authenticated (who are you?). 403 = authenticated but not allowed (I know you, you can't do this).
- *Q: When do you return 409?* → Conflict with current resource state — e.g. optimistic-lock version mismatch, or trying to book a seat that was just taken. (Foreshadows Tier 1.)

## Challenge 0.5 — Auto-`sync({alter})` on every boot + a silent typo

**Symptom.** AuthService ran `db.sequelize.sync({alert:true})` on startup — note the typo `alert` (not `alter`), so the intended behavior didn't even happen. FlightsService ran `sync({alter:true})` on every boot gated by an inconsistent env var (`SYNC_DB` vs `DB_SYNC` elsewhere).

**Why it matters.** `sequelize.sync({alter:true})` inspects your models and **automatically mutates the live database schema** to match. On a production database this is genuinely dangerous — it can drop columns, change types, and lock tables, with no review and no rollback. Schema changes must be **explicit, versioned, and reviewable**. That's what migrations are for (and this project *already has* a `migrations/` folder — the auto-sync was undermining it).

**The concept — Schema migrations vs auto-sync.**
- **Migrations** are versioned, ordered scripts (`up`/`down`) checked into git. They give you a reviewable history, safe rollbacks, and identical schema across dev/staging/prod. This is how every serious team manages schema.
- **Auto-sync** is a dev convenience that guesses the diff. Fine for a quick local spike; a foot-gun in prod.

**The fix.** Auto-sync is now off by default and only opt-in via one consistent env flag for local dev; the source of truth is migrations. Env var name standardized.

**Interview drill.**
- *Q: How do you evolve a database schema without downtime?* → Migrations, applied in a backward-compatible sequence: add nullable column → backfill → start writing → make non-null → remove old column in a later deploy (expand/contract pattern).

## Challenge 0.6 — Hardcoded service URLs & unusable rate limit

**Symptom.** `booking-service.js` hardcoded `http://localhost:3001/api/v1/user/...` for the auth lookup. The API Gateway's rate limit was **5 requests per 2 minutes** — low enough to lock out a single real user.

**Why it matters.** Hardcoded `localhost` URLs mean the system **only runs on your laptop** — it can't be containerized, deployed, or scaled, because in real environments services find each other by DNS/service-discovery names, not `localhost:port`. And a broken rate limit is a self-inflicted denial of service.

**The concept — Configuration & the 12-Factor App.**
- **Config lives in the environment, not the code** (12-Factor principle III). The same build artifact should run in dev/staging/prod by changing env vars only.
- **Service discovery**: services address each other by logical names resolved at runtime (env, DNS, Consul, Kubernetes services), so you can move/scale them freely.
- **Rate limiting** protects against abuse and cascading overload — but the limit must reflect real usage.

**The fix.** All service URLs moved to env/config. Rate limit set to a sane production-ish value, ready to become per-user later.

**Interview drill.**
- *Q: Why not hardcode config?* → Same artifact across environments, secrets stay out of source, no rebuild to reconfigure, and it's testable.
- *Q: How do services find each other in production?* → Service discovery (DNS-based in Kubernetes, or a registry like Consul/Eureka), usually behind a load balancer.

## Challenge 0.7 — Dead code, misleading comments, and unprofessional strings

**Symptom.** Large commented-out blocks in most files, and user-facing error strings like `"tumse na ho payi"` and `"something went wrong"`.

**Why it matters.** This is the **signal layer** of a resume project. A reviewer skims for professionalism before depth. Dead code and joke strings read as "unfinished tutorial." Clean, intentional code reads as "engineer." Cheap to fix, disproportionate payoff.

**The fix.** Removed dead code (git history preserves it if ever needed — that's what version control is *for*). Replaced all error strings with clear, professional messages.

---

# Tier 1 — Concurrency, Consistency & Distributed Transactions

> This is the tier that makes the project an SDE2-signal. Tier 0 made the code *correct in isolation*. Tier 1 makes it correct *under concurrency and partial failure* — the two things that define distributed systems.

## Challenge 1.1 — Overselling seats (the lost-update race) ⭐ flagship

**Symptom.** The booking flow decremented seats with a **read-modify-write across two services**: BookingService did `GET /flights/:id` to read `totalSeats`, subtracted in JavaScript, then `PATCH /flights/:id` to write the new value. Under concurrency this loses updates. We *proved* it: 100 simultaneous bookings on a 5-seat flight → **100 succeeded, 95 seats oversold** (see `loadtest/RESULTS.md`).

**Why it matters.** Overselling is a real airline's worst operational nightmare — passengers with valid tickets and no seat, compensation payouts, brand damage. This exact race (inventory, wallet balances, stock counts, rate limits) is *the* most common concurrency question in system-design and backend interviews. Being able to say "I hit this, proved it with a load test, and fixed it three different ways" is gold.

**The concept — Race conditions, lost updates & concurrency control.**

A *race condition* is when correctness depends on the timing/interleaving of concurrent operations. The specific one here is a **lost update**:

```
Time  Request A                    Request B
 t1   read totalSeats = 2
 t2                                read totalSeats = 2
 t3   write 2 - 1 = 1
 t4                                write 2 - 1 = 1   ← A's decrement is lost
```

Both booked, but the count only dropped by 1. There are three standard ways to prevent it:

| Approach | How it works | Trade-off | When to use |
|---|---|---|---|
| **Atomic conditional write** (what we used) | One SQL statement: `UPDATE … SET seats = seats - n WHERE seats >= n`. The read-check and the write are indivisible; the DB serializes writers to the same row. | Simplest, fastest, no retries, no explicit locks. Only works when the operation *is* expressible as one statement (counters, flags). | Inventory counters, balances — our exact case. |
| **Pessimistic locking** | `SELECT … FOR UPDATE` inside a transaction locks the row; other txns *wait* until you commit. | Bulletproof, but holds a lock → lower throughput and risk of deadlocks under heavy contention. | Complex read-modify-write you can't express in one statement; low-contention critical sections. |
| **Optimistic locking** | Add a `version` column. Read it, and on write do `UPDATE … WHERE version = :v` then `version = v+1`. If 0 rows updated, someone else changed it → **409 Conflict**, retry. | No locks held → high throughput; but you must handle retries and conflicts. | High-read, low-conflict workloads; Sequelize/JPA/Hibernate support it natively (`version: true`). |

We chose the **atomic conditional write** because seat inventory *is* a counter — it's the simplest tool that fully solves the problem, needs no retries, and has the lowest latency. The other two are documented here because interviewers love the comparison.

**The fix.** A dedicated, atomic reservation API in the FlightService:
- `reserveSeats` → `UPDATE Flights SET totalSeats = totalSeats - n WHERE id = ? AND totalSeats >= n`. Returns whether exactly one row changed. (`flight-repository.js`)
- Exposed as `POST /flights/:id/seats/reserve` → **409** when seats are unavailable, and `POST /flights/:id/seats/release` as the Saga's compensating action.
- The BookingService now calls this instead of doing its own read-modify-write.

**Proof.** `loadtest/seat-concurrency-test.js` runs both modes; `loadtest/RESULTS.md` captures the before/after. Zero overselling under the fix.

**Interview drill.**
- *Q: Walk me through how two users booking the last seat can both succeed.* → The lost-update sequence above. Fix: make the check-and-decrement atomic (single conditional UPDATE / row lock / version check).
- *Q: Optimistic vs pessimistic locking — when would you pick each?* → Optimistic when conflicts are rare and throughput matters (retry on the rare clash). Pessimistic when conflicts are common or the critical section is complex and a retry would be expensive/incorrect.
- *Q: Your atomic UPDATE works on one row. What if inventory were sharded across rows/nodes?* → Now you need distributed coordination: a distributed lock (Redis Redlock), a single-writer partition per flight, or a consensus/serializable-isolation store. Good segue into partitioning.
- *Q: Does database isolation level matter here?* → For the single atomic UPDATE, no — the statement is atomic at any isolation level. For the SELECT-FOR-UPDATE approach, you need at least READ COMMITTED and an explicit transaction. For multi-statement invariants, you'd consider REPEATABLE READ / SERIALIZABLE.

---

## Challenge 1.2 — The fake transaction across services (Saga pattern) ⭐

**Symptom.** `createBooking` opened a Sequelize transaction (`sequelize.transaction()`) and *appeared* atomic — but the seat change was a **cross-service HTTP call** (`axios.patch` to the flight service) sitting *outside* that transaction. A local DB transaction can only roll back local writes; it has zero power over a remote service's database. So if the HTTP call succeeded but the local `commit()` failed (or vice versa), the two databases were left permanently inconsistent — a booking with no seats deducted, or seats deducted with no booking.

**Why it matters.** This is *the* defining problem of microservices: **you cannot have an ACID transaction spanning multiple services/databases.** There's no `BEGIN … COMMIT` across network boundaries. Interviewers ask this directly: *"How do you keep data consistent across services without distributed transactions?"* The answer is the Saga pattern, and now you've built one.

**The concept — Sagas & compensating transactions.**
- A **Saga** breaks one logical operation into a sequence of **local transactions**, each in its own service. Each step has a **compensating action** that semantically undoes it.
- If step *k* fails, you run the compensations for steps *k-1 … 1* in **reverse order**, returning the system to a consistent state. You trade *atomicity* (all-or-nothing instantly) for **eventual consistency** (the system converges to consistent).
- Two flavors: **orchestration** (one coordinator drives the steps — what we built, easier to reason about) vs **choreography** (services react to each other's events — more decoupled, harder to trace).
- Compensation is *semantic*, not a rollback: you can't "un-send" an email, so you send a cancellation; you can't un-charge instantly, so you issue a refund.

**Our saga (orchestrated by BookingService, `booking-service.js`):**

| Step | Forward action | Compensating action |
|---|---|---|
| 1 | Create booking as `InProcess` | Mark booking `Cancelled` |
| 2 | Reserve seats (atomic, remote — Challenge 1.1) | Release seats |
| 3 | Confirm booking → `Booked` | *(terminal success)* |

Implemented with a **compensation stack**: each successful forward step pushes its undo action; on any failure we pop and run them in reverse. Notifications are deliberately *outside* the saga (a failed email must never cancel a paid booking — that's what the Outbox in 1.3 is for).

**Proof (real run against live services):**
```
TEST 1 happy path : book 2 seats  → HTTP 201, status=Booked, seats 350→348
TEST 2 failure    : book 999999   → HTTP 409, booking auto-Cancelled,
                                     seats stayed 348 (compensation released nothing to leak)
```
The failed booking left a `Cancelled` row and **zero seat leakage** — the saga unwound correctly.

**Interview drill.**
- *Q: Why can't you just use a distributed transaction (2PC)?* → Two-Phase Commit exists but is rarely used in microservices: it holds locks across services for the whole protocol (kills availability and throughput), needs a coordinator that's a single point of failure, and most modern datastores/brokers don't support it well. Sagas trade strict atomicity for availability + eventual consistency.
- *Q: Orchestration vs choreography?* → Orchestration = central coordinator (clear control flow, easier debugging, but the coordinator is a hotspot). Choreography = event-driven, each service reacts (decoupled, scales, but flow is implicit and harder to trace).
- *Q: What if a compensation itself fails?* → It must be retryable/idempotent; persistent failures go to a dead-letter/reconciliation queue and alert a human. Never silently swallow it.
- *Q: How is this "consistent" if there's a window where seats are reserved but the booking isn't confirmed?* → It's *eventually* consistent. During the window the seat is held (correct — nobody else can take it). If the process dies mid-saga, the auto-expiry sweeper (Challenge 1.4) reclaims the orphaned hold.

---

## Challenge 1.3 — Double-booking on retry (Idempotency)

**Symptom.** `createBooking` had no protection against being called twice for the same intent. A user double-clicking "Book", a mobile client retrying after a flaky network, or a load balancer replaying a request would each create a **separate booking** and reserve seats **again** — double charge, double seat consumption.

**Why it matters.** Retries are not an edge case; they are *normal* in distributed systems. Networks drop responses, clients time out and retry, queues redeliver. Any endpoint that changes state or money **must** be safe to call more than once. This is why every serious payments/booking API (Stripe, PayPal, airlines) supports an idempotency key. It's a very common interview and design-review topic.

**The concept — Idempotency & at-least-once delivery.**
- An operation is **idempotent** if doing it N times has the same effect as doing it once. `GET`, `PUT`, `DELETE` are idempotent by HTTP definition; `POST` is *not* — so we make it idempotent explicitly.
- The client sends a unique **Idempotency-Key** (a UUID it generates). The server records it with the result. A repeat with the same key returns the *original* result instead of re-executing.
- The subtle part is the **race**: two requests with the same key arriving simultaneously both pass the "have I seen this key?" check. The fix is a **UNIQUE database constraint** on the key — the DB guarantees only one row can win; the loser catches the constraint violation and returns the winner's booking. The database is the source of truth for "who's first," not application code.

**The fix (`booking-service.js`, `booking-repository.js`, migration + model):**
1. Added a `idempotencyKey` column with a **UNIQUE** constraint on `Bookings`.
2. Controller reads the standard `Idempotency-Key` header.
3. Service: check for an existing booking with the key → if found, return it (fast path). On create, if a concurrent request already inserted the key, the `SequelizeUniqueConstraintError` is caught and we return the existing booking (race-safe path).

**Proof (real run):**
```
Same key sent 2x sequentially : both returned booking #10 (same row)
Same key fired 5x concurrently : exactly 1 booking exists with that key
Seats decremented              : exactly 3 (once), not 3 × N requests
```

**Interview drill.**
- *Q: How do you make a POST idempotent?* → Client sends a unique key; server stores key→result; repeats return the stored result. Enforce uniqueness with a DB constraint to survive concurrent duplicates.
- *Q: Where do you store the key and for how long?* → With the created resource (as we did) or a dedicated idempotency table with a TTL (e.g. 24h). TTL bounds storage while covering realistic retry windows.
- *Q: Idempotency vs deduplication vs exactly-once?* → "Exactly-once delivery" is largely a myth in distributed systems; you get **at-least-once** delivery + **idempotent processing**, which together *behave* like exactly-once. Idempotency is how you tolerate the duplicates that at-least-once guarantees you'll get.
- *Q: What if the first request is still in flight when the retry arrives?* → The UNIQUE constraint serializes them; the second either returns the in-progress/So-far result or is told to retry. Some systems store a "pending" state per key to return 409/202 while the first completes.

---

## Challenge 1.4 — Losing events on crash (Transactional Outbox) ⭐

**Symptom.** The saga confirmed the booking in MySQL and *then* published the notification event to RabbitMQ as two separate steps. If the process crashed (or the broker was briefly down) *between* the DB commit and the publish, the booking was confirmed but **the event vanished** — the customer never gets their confirmation. The reverse ordering is just as broken: publish first, then a DB failure means you've announced a booking that doesn't exist.

**Why it matters.** This is the **dual-write problem**, and it's one of the most-asked senior/staff-level design questions. You are writing to two independent systems (a database and a message broker) and there is **no transaction that spans both**. Naively doing them in sequence *always* has a crash window. The Transactional Outbox is the standard, production-grade answer (used at essentially every event-driven company).

**The concept — The dual-write problem & the Outbox pattern.**
- You can't atomically "commit to DB AND publish to broker." So don't try. Instead, **write the event as a row in an `outbox` table inside the same local DB transaction** as the state change. Now the state change and the record-of-intent-to-publish are **atomic** — they commit together or not at all (this the database *can* guarantee).
- A separate **relay/poller** reads `PENDING` outbox rows and publishes them to the broker, marking each `PUBLISHED` on success. If a publish fails, the row stays `PENDING` and is retried. This yields **at-least-once delivery** — the event is never lost, though it may be delivered more than once (hence consumers must be idempotent).
- Keep all network I/O (e.g. resolving the user's email) **in the relay, not in the transaction**, so the transaction stays short and local.
- The mature evolution of this is **Change Data Capture (CDC)** — a tool like Debezium tails the DB's write-ahead log and emits the outbox inserts to Kafka, removing the polling relay entirely. Good thing to mention as "how I'd scale it."

**The fix (`booking-service.js` step 3, `outbox-*.js`, migration + model):**
1. New `Outboxes` table (`eventType`, `payload`, `status`, `publishedAt`), indexed on `status`.
2. Booking confirmation and the outbox insert now happen in **one `sequelize.transaction()`**.
3. `outbox-relay.js` polls every 5s, resolves the recipient email, publishes to RabbitMQ, and marks the row `PUBLISHED`. Failures stay `PENDING` for retry.

**Proof (real run, full chain):**
```
POST /bookings           → booking #11 Booked
Outboxes row (t+0s)      → id 1, BOOKING_CONFIRMED, status=PENDING
Outboxes row (t+6s)      → id 1, status=PUBLISHED, publishedAt set
ReminderService DB       → NotificationTicket #27 "Your flight booking is confirmed", SUCCESS
```
The event survived as a committed DB row *before* it was ever published, then flowed all the way to a notification — no crash window.

**Interview drill.**
- *Q: What's the dual-write problem?* → Writing to two systems (DB + broker) with no shared transaction; any crash between them loses or orphans data.
- *Q: How does the Outbox solve it?* → Write the event to an outbox table in the same DB transaction as the state change (atomic), then relay it to the broker asynchronously with retries.
- *Q: Doesn't the relay double-publish sometimes?* → Yes — it's at-least-once. That's acceptable because consumers are idempotent (tie-in to Challenge 1.3). Exactly-once is achieved as at-least-once delivery + idempotent processing.
- *Q: Polling is inefficient at scale — what then?* → Change Data Capture (Debezium) streaming the outbox table's WAL to Kafka, or a DB-native notification (e.g. Postgres LISTEN/NOTIFY) to avoid constant polling.

---

## Challenge 1.5 — Orphaned seat holds (Auto-expiry sweeper)

**Symptom.** A booking is created `InProcess` and only becomes `Booked` when the saga finishes. But if the BookingService process **crashes mid-saga** — after reserving seats (step 2) but before confirming (step 3) — the compensation stack dies with the process and never runs. The result: an `InProcess` booking that holds seats **forever**. A slow, invisible seat leak that shrinks sellable inventory over time.

**Why it matters.** This is the failure mode the saga's in-process compensation *can't* cover, because the compensator itself died. Every real hold-based system (airline seats, event tickets, e-commerce carts) needs a **timeout + reaper** for holds. It's also a great demonstration that you think about *crash* failures, not just logical ones.

**The concept — Leases/TTLs and reaper jobs.**
- Treat a reservation as a **lease with a TTL**, not a permanent grab. If it isn't confirmed within the TTL, it's presumed abandoned and reclaimed.
- A periodic **reaper/sweeper** job scans for expired leases and runs the compensation out-of-band. This is *self-healing*: the system converges back to a consistent state without human intervention.
- **The correctness subtlety:** the sweeper must release seats **only for holds that actually reserved them**. A booking that crashed *before* step 2 is `InProcess` too, but releasing seats it never took would wrongly inflate inventory. We track this with a `seatsReserved` flag set the moment step 2 succeeds — so the sweeper knows the difference.
- Sweeper actions must be **idempotent / safe to retry** (it runs forever on a timer), and it filters on `status = InProcess` so a cancelled hold is never reclaimed twice.

**The fix (`booking-sweeper.js`, `booking-repository.js`, migration + model):**
1. Added `seatsReserved` boolean to `Bookings`; the saga sets it `true` right after a successful reservation.
2. `findExpiredHolds(cutoff)` returns `InProcess` bookings older than the hold TTL.
3. Sweeper runs every 60s: for each expired hold, release seats **iff `seatsReserved`**, then mark `Cancelled`. Configurable via `BOOKING_HOLD_TTL_MINUTES` (default 15).

**Proof (real run):**
```
Orphaned hold #12: InProcess, seatsReserved=1, holding 5 seats
sweeper → release 5 seats, mark Cancelled
Flight seats 339 → 344 (exactly the 5 reclaimed)
Booking #12 → status=Cancelled, seatsReserved=0
```

**Interview drill.**
- *Q: Your saga compensates on failure — why also need a sweeper?* → In-process compensation can't run if the *process itself* crashes. The sweeper is the out-of-band safety net for crash failures; together they make the system self-healing.
- *Q: How do you avoid releasing seats twice?* → Idempotent design: filter on `InProcess` (cancelled holds drop out), track `seatsReserved` so we only release real holds, and once cancelled the row won't be picked up again.
- *Q: Why not just use a DB TTL / expire column?* → You can (e.g. an `expiresAt` and a job/CDC), but you still need the *action* (releasing remote seats) which a raw DB TTL can't perform — hence a job. At scale, a delay queue (RabbitMQ TTL + dead-letter, or a scheduler) can trigger per-hold expiry instead of polling.

---

# Tier 1 summary — what to say in an interview

> *"I took a naive booking flow and made it correct under concurrency and partial failure: atomic seat reservation (no overselling, load-tested), a Saga with compensating transactions to replace an impossible cross-service ACID transaction, idempotency keys for safe retries, the Transactional Outbox so events survive crashes, and an auto-expiry sweeper that reclaims orphaned holds. Together these give at-least-once delivery with idempotent, self-healing, eventually-consistent processing."*

# Tier 2 — Engineering Rigor (the SDE1 gate)

> Tier 1 proved you can solve hard problems. Tier 2 proves you build like a professional: tested, automated, observable, resilient. "No tests" alone caps a project below the SDE1 bar at most companies — this tier closes that.

## Challenge 2.1 — No automated tests (Testing + CI)

**Symptom.** The README advertised "Jest, Supertest" but there was **not a single test** in the codebase, and no CI. Every change was verified by hand, if at all — which doesn't scale and doesn't survive a code review.

**Why it matters.** Tests are how you make change *safe*. Without them, every refactor is a gamble and reviewers can't trust your PR. A green CI badge is often a literal checkbox in hiring screens. More deeply: writing tests *forces better design* — code that's hard to test is usually too tightly coupled (which is why we added dependency injection to the saga).

**The concept — The test pyramid & designing for testability.**
- **Unit tests** (many, fast, isolated): test one function/class with its dependencies mocked. Milliseconds each; run on every save and in CI with no infrastructure.
- **Integration tests** (fewer): test real collaboration — e.g. hitting a real DB or the reserve endpoint end-to-end.
- **E2E tests** (fewest): the whole system through the front door.
- **Testability is a design property.** Our saga takes its repositories via the constructor (dependency injection), so tests inject fakes instead of a real DB/broker. We mock `axios` and `sequelize.transaction`, so the *saga logic* is tested without any I/O.

**What we built:**
- **BookingService** (`test/booking-service.test.js`): 5 unit tests covering the saga — happy path (reserve → confirm → outbox), 409 insufficient-seats + compensation, idempotent replay, failure-after-reserve unwinding compensations in reverse, and input validation.
- **FlightsAndSearchService** (`test/flight-repository.test.js`): 4 unit tests for atomic reservation — reserves on 1 affected row, rejects on 0 (insufficient/lost race), validates seat counts, releases seats.
- **CI** (`.github/workflows/ci.yml`): GitHub Actions runs both suites on every push and PR, as a matrix across services. Because everything is mocked, CI needs no MySQL/RabbitMQ — fast and deterministic.

**Proof:** `npm test` → 9 tests green in < 0.5s per service.

**Interview drill.**
- *Q: What's the test pyramid?* → Many fast isolated unit tests at the base, fewer integration tests, fewest E2E at the top. Optimizes for fast feedback and cheap maintenance.
- *Q: How did you test a flow that spans a DB and a message broker without them?* → Dependency injection + mocking the I/O boundaries (repositories, axios, transaction). The orchestration logic is pure and testable; the real I/O is covered by a few integration tests.
- *Q: Unit vs integration — where's the line?* → Unit: no real I/O, everything mocked. Integration: at least one real collaborator (DB, HTTP). Different speed/confidence trade-offs.

---

## Challenge 2.2 — Messages lost on restart & poison messages (Durable queues + DLQ)

**Symptom.** Two reliability holes in the messaging layer:
1. The exchange was declared **non-durable** (`assertExchange(name, 'direct', false)`) and messages weren't persistent — a RabbitMQ restart **silently discarded** every in-flight message.
2. The consumer did `service(data); channel.ack(msg)` with **no error handling** and acked unconditionally. A message that failed processing (or wasn't valid JSON) was either **lost** (acked anyway) or, if it threw before ack, could be **redelivered forever** — a "poison message" that jams the queue.

**Why it matters.** The whole point of the Outbox (Challenge 1.4) is to never lose an event — but that guarantee ends the moment the broker drops it. Durability has to be **end to end**: durable exchange + durable queue + persistent message. And every real consumer eventually meets a message it can't process; without a **dead-letter queue**, that message either poisons the queue or vanishes. This is standard production messaging hygiene.

**The concept — Durability, acknowledgements & dead-lettering.**
- **Durable + persistent:** a durable exchange/queue survives a broker restart; a persistent message is written to disk. You need *all three* — a persistent message in a non-durable queue still dies with the queue.
- **Manual acks:** ack **only after** the work succeeds. If the consumer crashes mid-work, the message was never acked, so the broker redelivers it (at-least-once). Auto-ack (or acking before the work) means a crash loses the message.
- **Dead-Letter Queue (DLQ):** configure the main queue with a `deadLetterExchange`. On `nack(requeue=false)` (or TTL expiry / queue overflow), the broker routes the message to the DLX → DLQ instead of dropping or redelivering it. The DLQ is a parking lot for humans to inspect, fix, and replay.
- **prefetch(1):** limits unacked messages per consumer to 1 → fair dispatch and natural backpressure instead of one worker hoarding the queue.

**The fix (`messageQueue.js` in Booking + Reminder):**
- Durable direct exchange `airline_events`; all publishes use `{ persistent: true }`.
- Durable `reminder_queue` with `deadLetterExchange` → durable fanout `airline_events.dlx` → durable `reminder_dlq`.
- Consumer parses + `await service(data)` and **acks only on success**; on any error, `nack(msg, false, false)` dead-letters it. `prefetch(1)` for fair delivery.

**Proof (real runs):**
```
Happy path : booking -> outbox relay -> airline_events -> reminder_queue -> NotificationTicket #28
DLQ path   : publish non-JSON to airline_events/reminder_key
             -> consumer fails to parse -> nack(no requeue)
             -> reminder_dlq depth 0 -> 1, reminder_queue stays 0 (no loss, no crash-loop)
```

**Interview drill.**
- *Q: What does it take to not lose a message across a broker restart?* → Durable exchange **and** durable queue **and** persistent message — all three. Plus publisher confirms if you need to be sure the broker accepted it.
- *Q: Auto-ack vs manual ack?* → Manual ack after successful processing gives at-least-once (crash → redelivery). Auto-ack gives at-most-once (crash → loss). Choose based on whether loss or duplication is worse; here we want no loss, so manual ack + idempotent consumers.
- *Q: What's a poison message and how do you handle it?* → A message that always fails processing. Without handling it requeues forever or is dropped. Solution: nack-without-requeue to a DLQ (optionally after N retries), then alert/inspect/replay.
- *Q: How would you add retries before dead-lettering?* → A retry queue with a message TTL that dead-letters *back* to the main queue (delayed retry), plus a retry-count header; after N attempts, route to the terminal DLQ.

---

## Challenge 2.3 — No health checks (Liveness/readiness probes)

**Symptom.** No way to ask a service "are you alive and able to serve traffic?" A crashed or DB-disconnected instance would keep receiving requests and failing them.

**Why it matters.** Load balancers, Kubernetes, and uptime monitors need a cheap endpoint to decide whether to route traffic to an instance. Without it, a sick instance stays in rotation and users hit errors.

**The concept — liveness vs readiness.** *Liveness* = "is the process up?" (restart it if not). *Readiness* = "can it serve requests right now?" (e.g. is its DB reachable?). A readiness check that pings the DB and returns **503** when it's down lets the orchestrator route around the bad node without killing it.

**The fix.** `GET /health` on all five services; the DB-backed ones (auth, booking, flights) call `sequelize.authenticate()` and return 503 if the DB is unreachable. Verified all five respond.

## Challenge 2.4 — Unsearchable logs & no request tracing (Structured logging + correlation IDs) ⭐

**Symptom.** Every service logged with `console.log` — unstructured text. You couldn't filter by level or service, and there was **no way to follow one user action across services**. When a booking failed, you couldn't tell which of the booking/flight/auth calls broke or connect their log lines.

**Why it matters.** In a monolith a stack trace is enough. In microservices, one user action fans out across several processes, each writing to its own log. Without a shared **correlation ID**, debugging a production issue is guesswork. Structured JSON logs + correlation IDs are the foundation of observability (the "logs" pillar, alongside metrics and traces).

**The concept — structured logging & distributed tracing.**
- **Structured logging:** emit one JSON object per line (`{level, service, correlationId, msg, ...}`) instead of free text, so a log aggregator can index and query by field. `pino` is a fast JSON logger; `pino-http` logs every request automatically.
- **Correlation ID:** a unique id minted at the edge (or honored from an incoming `X-Correlation-Id`) and **propagated on every downstream call** via a header. Every log line for that user action carries the same id, so `correlationId=abc` returns the entire cross-service story.
- This is the poor-man's version of full **distributed tracing** (OpenTelemetry / Jaeger), which adds spans and timing on top of the same idea.

**The fix (`config/logger.js`, `middlewares/correlation-id.js`, `index.js`, saga):**
1. `pino` JSON logger (pretty in dev, raw JSON in prod, silent in tests).
2. Correlation-ID middleware honors incoming `X-Correlation-Id` or mints a UUID, attaches it to the request, and echoes it on the response.
3. `pino-http` logs each request with its correlationId.
4. The saga forwards the id as `x-correlation-id` on its outgoing calls to the flight service and logs saga events (`seats reserved`, `booking confirmed`, `saga failed, compensating`) with it.

**Proof:** `POST /bookings` with `X-Correlation-Id: trace-abc-123` → the id is echoed in the response header and forwarded to the flight service, so the whole flow shares one id.

**Interview drill.**
- *Q: Three pillars of observability?* → Logs (what happened), metrics (aggregate numbers/trends), traces (the path + timing of one request across services). Correlation IDs bridge logs into traces.
- *Q: How do you debug a request that touched five services?* → Propagate a correlation/trace id from the edge through every hop; filter all logs by it. Better: distributed tracing (OpenTelemetry) for spans and latency per hop.
- *Q: Why structured over plain logs?* → Machine-queryable: filter/aggregate/alert by field in a log system. Plain text needs brittle regex parsing.

---

## Challenge 2.5 — Trusting client input (Schema validation)

**Symptom.** Write endpoints accepted whatever the client sent. The booking endpoint did only ad-hoc checks deep in the service; a malformed body (missing `userId`, negative seats, a string where a number belongs) got partway through business logic before failing, with vague errors.

**Why it matters.** *Never trust client input* — it's both a correctness and a security principle. Validating at the **edge** (before business logic) rejects bad requests fast with precise, field-level errors, and shrinks the surface for injection/abuse. It also documents the contract: the schema *is* the API spec.

**The concept — schema validation & fail-fast at the boundary.**
- Define a **schema** (types, ranges, required fields) and validate the request against it in middleware, before the controller. Invalid → **400** with which fields failed and why.
- **Coercion + defaults:** JSON/query values are often strings; the schema coerces `"2"`→`2` and applies defaults (`noofSeats` default 1), so downstream code gets clean, typed data.
- Keeping validation in **middleware** keeps controllers focused on orchestration and makes the rule reusable across routes.

**The fix (`middlewares/validate.js`, booking route):** a `zod` schema (`flightId`, `userId` positive ints; `noofSeats` 1–50, default 1) enforced by a reusable `validateBody` middleware. Also removed leftover test endpoints (`/publish`, `/hi`) and dead controller code.

**Proof:**
```
{flightId:2, noofSeats:-3}            -> 400 [userId: expected number; noofSeats: >0]
{flightId:"abc", userId:2}            -> 400 [flightId: expected number]
{flightId:2, userId:2, noofSeats:1}   -> 201 Created
```

**Interview drill.**
- *Q: Where should validation live?* → At the edge, in middleware, before business logic — fail fast with clear errors, and keep the rule out of controllers/services.
- *Q: Validation vs sanitization?* → Validation rejects malformed input; sanitization neutralizes dangerous content (e.g. escaping). Parameterized queries/ORM (which we use) handle SQL injection; validation handles shape/range/type.
- *Q: Why coerce and default in the schema?* → Transport gives you strings; coercing centralizes the conversion and guarantees typed, complete data downstream instead of scattering `Number(...)` and `|| default` everywhere.

---

# Tier 2 summary — what to say in an interview

> *"I brought it up to production hygiene: Jest unit tests with a dependency-injected saga and GitHub Actions CI; durable queues with persistent messages and a dead-letter queue for poison messages; health/readiness probes; structured JSON logging with correlation IDs that trace a request across services; and schema validation at the edge. So the system isn't just correct — it's tested, observable, resilient, and safe to change."*

# Tier 3 — The X-factor

## Challenge 3.1 — Slow repeated searches (Redis cache-aside + invalidation) ⭐

**Symptom.** Flight search (`GET /flights`) hit MySQL and hydrated every matching row into a Sequelize model on **every request**, even though the same popular searches repeat constantly and the underlying data changes rarely. On a realistic 5,000-flight dataset this measured **~1,523ms p50** under load.

**Why it matters.** Search is the most-hit, most read-heavy endpoint in a booking system, and it's dominated by repeated identical queries. Caching is *the* lever for read scalability, and **cache invalidation** is famously one of the two hard problems in computer science — being able to say "I cached it *and* kept it correct" is a strong signal.

**The concept — cache-aside, TTL, and invalidation.**
- **Cache-aside (lazy loading):** on read, check the cache; on a **miss**, read the DB and populate the cache; on a **hit**, skip the DB entirely. The app owns the cache (vs read-through where the cache library does).
- **TTL** bounds staleness even if invalidation is missed — a safety net, not the primary correctness mechanism.
- **Invalidation is the hard part.** A booking changes a flight's seat count, so cached search results must not go stale. Naively deleting every affected search key is O(n) and error-prone. We use a **generation counter**: every search key is suffixed `:v<gen>`, and any flight write does `INCR flights:gen`. All previously-cached keys instantly become unreachable (and TTL-expire) — **O(1) invalidation of the entire search namespace**. This is cache "versioning."
- **Graceful degradation:** if Redis is down, every cache function returns null/no-ops and the service serves straight from the DB. The cache is an optimization, never a dependency.

**The fix (`config/cache.js`, `flight-service.js`):**
- `getAllFlightData` is cache-aside: hash the query → look up `flights:search:<hash>:v<gen>` → return on hit, else DB + populate. `?nocache=1` bypasses it (for benchmarking).
- Every write path — create flight, update flight, reserve seats, release seats — calls `invalidateSearch()` (`INCR flights:gen`).
- Config via `REDIS_URL`, `CACHE_ENABLED`, `CACHE_TTL_SECONDS`. Redis added to `docker-compose.yml`.

**Proof (real benchmark, 5,003 flights, 3,000 requests @ concurrency 50):**
```
UNCACHED (MySQL+ORM) : p50 1523ms  p95 1678ms
CACHED   (Redis)     : p50  342ms  p95  470ms
Speedup              : p50 4.5x     p95 3.6x
Invalidation verified: each flight write bumps flights:gen (0 -> 1 -> 2 ...)
```

**Interview drill.**
- *Q: Cache-aside vs read-through vs write-through vs write-behind?* → Aside: app checks cache then DB (lazy). Read-through: cache fetches from DB on miss. Write-through: writes go to cache+DB synchronously (consistent, slower writes). Write-behind: write to cache, flush to DB async (fast, risk of loss). We used aside — simple and the standard default.
- *Q: How do you invalidate?* → TTL for bounded staleness + explicit invalidation on writes. We used a generation counter for O(1) namespace-wide invalidation instead of scanning/deleting keys.
- *Q: What's the cache stampede / thundering herd problem?* → When a hot key expires, many requests miss simultaneously and all hit the DB. Mitigations: a short lock/single-flight so one request repopulates, or staggered/soft TTLs.
- *Q: How do you keep the cache consistent with the DB?* → Invalidate (or update) on every write; accept eventual consistency within the TTL; for strict needs use write-through. Know that "cache invalidation is hard" and design for graceful staleness.
- *Q: Why not just cache `getFlight` by id too?* → Seat counts change on every booking, so a per-flight cache would need invalidation on every reserve/release (high churn) or a very short TTL. We cache the *search* (less volatile shape) and invalidate on writes; the authoritative seat check stays the atomic UPDATE (Challenge 1.1).

---

## Challenge 3.2 — No metrics or dashboards (Prometheus + Grafana) ⭐

**Symptom.** After adding structured logs (Challenge 2.4) we could trace a single request, but we had **no aggregate view**: request rate, latency percentiles, error ratio, cache hit ratio, booking throughput. You can't run a system you can't see in aggregate, and you can't alert on trends you don't measure.

**Why it matters.** Logs answer "what happened in *this* request"; **metrics** answer "how is the system behaving *overall*, right now and over time." Metrics are the basis of dashboards, alerting, capacity planning, and SLOs. Prometheus + Grafana is the de-facto open-source stack, and a dashboard is a concrete, visual portfolio artifact.

**The concept — metrics, the RED method, and pull-based scraping.**
- **Metric types:** *counter* (monotonic, e.g. `bookings_total`), *gauge* (up/down, e.g. memory), *histogram* (bucketed distribution → percentiles, e.g. request duration). We use all three.
- **RED method** for request-driven services: **R**ate, **E**rrors, **D**uration — the three things to watch per endpoint. Our HTTP histogram (`http_request_duration_seconds`) gives all three via PromQL.
- **Pull model:** Prometheus *scrapes* each service's `/metrics` endpoint on an interval (vs push). Services just expose the endpoint; Prometheus owns collection, storage, and querying (PromQL).
- **Cardinality caution:** labels multiply time-series. We label by `service`, `route`, `status`, `outcome` — bounded sets. Never label by unbounded values (user id, booking id) or you explode Prometheus's memory.

**The fix (`config/metrics.js` in booking + flights, `monitoring/`, `docker-compose.yml`):**
- `prom-client` registry per service; default process metrics + a request-duration histogram (middleware) + business counters (`bookings_total{outcome}`, `flight_search_cache_events_total{result}`), exposed at `GET /metrics`.
- Prometheus (`monitoring/prometheus.yml`) scrapes both services every 5s via `host.docker.internal` (services run on the host).
- Grafana with **auto-provisioned** datasource + dashboard (`monitoring/grafana/…`): request rate, p95 latency, booking outcomes, cache hit ratio. `docker compose up -d` brings the whole stack up.

**Proof (real run):**
```
Prometheus targets : booking UP, flights UP
Scraped metrics    : bookings_total{outcome="success"}, flight_search_cache_events_total{result="hit|miss"}
Grafana            : dashboard "Airline Booking System" auto-provisioned at :3000
```
**Insight surfaced by the metrics:** under an interleaved read/write load the cache hit ratio was low — because every seat reserve/release invalidates the whole search cache (coarse invalidation). In a real search-heavy workload (reads ≫ writes per flight set) the ratio is high; a finer design would exclude volatile seat counts from the cached search shape.

**Access:** Grafana `http://localhost:3000` (admin/admin), Prometheus `http://localhost:9090`.

**Interview drill.**
- *Q: Logs vs metrics vs traces?* → Logs = discrete events (what happened here). Metrics = aggregated numeric time-series (how's the system overall). Traces = one request's path+timing across services. You need all three.
- *Q: Push vs pull monitoring?* → Prometheus pulls (scrapes `/metrics`): simpler service code, central control of intervals, easy target health. Push (e.g. StatsD) suits short-lived jobs; Prometheus covers those with a Pushgateway.
- *Q: Counter vs gauge vs histogram?* → Counter only goes up (rate() it); gauge goes up/down; histogram buckets values so you can compute quantiles (p95/p99) server-side.
- *Q: What's a good SLI/SLO here?* → SLI: fraction of booking requests < 500ms and non-5xx. SLO: 99.9% over 30 days. Alert when the error budget burns too fast.

---

## Challenge 3.3 — Weak, scattered edge (API Gateway hardening) ⭐

**Symptom.** The gateway only proxied one service, with hardcoded URLs, an IP-based rate limit, and auth done by making an HTTP round-trip to the auth service **on every request**. Other services were reachable only by knowing their internal ports, each would have had to re-implement auth, and a client could set any `userId` in a booking body — so **user A could book as user B**.

**Why it matters.** In microservices the gateway is the **single front door**: it's where you centralize cross-cutting concerns (routing, authN, rate limiting, TLS termination, request shaping) so N services don't each reimplement them. Getting identity right here is a real security control — the gateway is the trust boundary between the untrusted internet and the trusted internal network.

**The concepts.**
- **API Gateway pattern:** one entry point routes to many services by path prefix, and owns cross-cutting concerns. Services can then assume traffic is already authenticated/rate-limited.
- **Centralized authentication + token verification at the edge:** verify the JWT **locally** with the shared secret (no per-request network hop to the auth service — faster and more resilient), then **propagate identity** to downstream services via a trusted header (`x-user-id`). Internal services trust the gateway (defense-in-depth: they're not exposed publicly).
- **Never trust client-supplied identity:** the booking `userId` now comes from the **verified token**, not the request body — so an authenticated user can only book for themselves. The body value is ignored.
- **Per-user vs per-IP rate limiting:** IP limits are unfair behind NAT/corporate proxies (many users, one IP) and trivially bypassed (many IPs, one attacker). Keying the limiter on the authenticated **user id** is the correct unit of abuse control for protected routes; a coarse per-IP limit stays as a global safety net.

**The fix (`API_Gateway/index.js`, `.env`):**
- All services behind clean prefixes: `/auth/*` (public), `/flights/*` (reads public, writes authenticated), `/bookings/*` (fully protected).
- JWT verified locally with the shared secret; decoded user attached and forwarded as `x-user-id` / `x-user-email`.
- Booking controller uses `x-user-id` over any body `userId` (schema made `userId` optional since it's derived from the token).
- Two-tier rate limiting: global per-IP (300/15m) + per-user (30/min) on bookings.
- Config (secret, service URLs) moved to env. (Gotcha fixed: proxies are root-mounted with `pathFilter` because `app.use('/prefix', proxy)` makes Express strip the prefix and breaks `pathRewrite`.)

**Proof (real runs, all through the gateway on :3006):**
```
POST /auth/signup, /auth/signin        -> 200, JWT issued
GET  /flights (no token)               -> 200 (public read)
POST /bookings (no token)              -> 401 Authentication token required
POST /bookings (token, body userId=999)-> 201, booking.userId = 15 (from JWT, body ignored)
40 bookings in <1 min with one token   -> 30x pass, 10x 429 (per-user limit)
```

**Interview drill.**
- *Q: What does an API gateway do?* → Single entry point: routing, authN/authZ, rate limiting, TLS termination, request/response shaping, observability — centralizing cross-cutting concerns so services stay focused on business logic.
- *Q: Verify the JWT at the gateway or each service?* → At the gateway (once) for edge authN, then propagate a trusted identity header; services can additionally authorize. Verifying locally with the shared secret avoids a per-request hop to the auth service.
- *Q: Why not trust the userId in the request body?* → Clients are untrusted; they'd impersonate others. Identity must come from the verified token. This is a classic IDOR/broken-access-control class of bug.
- *Q: Per-IP vs per-user rate limiting?* → Per-IP is unfair behind shared IPs and easy to evade with many IPs; per-user (from the token) is the right unit for authenticated abuse control. Use both: coarse per-IP net + fine per-user.
- *Q: How do you stop clients bypassing the gateway and hitting services directly?* → Network isolation: services live on a private network; only the gateway is public (enforced by k8s NetworkPolicies / security groups / a service mesh with mTLS).

---

# Project summary — the whole story in one paragraph

> *"I took a tutorial-grade airline booking backend and hardened it to production standards. I fixed correctness bugs (including a silent messaging failure), then solved the hard distributed-systems problems: atomic seat reservation (zero overselling, load-tested), a Saga with compensating transactions replacing an impossible cross-service ACID transaction, idempotency keys, the Transactional Outbox for crash-safe events, and an auto-expiry sweeper for orphaned holds. I added engineering rigor — unit tests + CI, durable queues with a dead-letter queue, health checks, structured logging with correlation-ID tracing, and edge validation. Finally I added a Redis cache-aside layer with generation-counter invalidation that cut search latency ~4.5×. Every change is documented with the problem, the concept, and the trade-offs."*
