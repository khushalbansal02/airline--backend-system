/**
 * Seat-concurrency load test — proves the airline never oversells seats.
 *
 * WHY THIS EXISTS
 * ---------------
 * The classic bug in any booking/inventory system is the "lost update" race:
 *   1. Request A reads "2 seats left"
 *   2. Request B reads "2 seats left"   (before A has written)
 *   3. A books 2 and writes "0"
 *   4. B books 2 and writes "0"
 *   => 4 seats sold on a 2-seat flight. Overbooked.
 *
 * This script fires MANY concurrent booking attempts at a flight that only has
 * a FEW seats and checks the core invariant: seats_sold <= seats_available,
 * and the stored seat count never goes negative.
 *
 * MODES
 * -----
 *   --mode=naive   Reproduces the bug: each worker does GET (read seats) then
 *                  PATCH (write seats - k). Two separate calls => race window.
 *   --mode=atomic  The fix: each worker calls POST /seats/reserve, a single
 *                  atomic conditional UPDATE in the DB. No race window.
 *
 * USAGE
 *   node loadtest/seat-concurrency-test.js --mode=atomic --seats=5 --concurrency=100
 *   node loadtest/seat-concurrency-test.js --mode=naive  --seats=5 --concurrency=100
 *
 * Requires FlightsAndSearchService running (default http://localhost:3003).
 */

const BASE = process.env.FLIGHT_SERVICE_PATH || 'http://localhost:3003';
const API = `${BASE}/api/v1`;

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
}

const MODE = arg('mode', 'atomic');            // 'atomic' | 'naive'
const FLIGHT_ID = Number(arg('flight', '1'));  // which flight to hammer
const SEATS = Number(arg('seats', '5'));       // seats to stock the flight with
const CONCURRENCY = Number(arg('concurrency', '100')); // simultaneous bookings
const SEATS_PER_BOOKING = Number(arg('per', '1'));     // seats each booking wants

async function getFlight(id) {
  const res = await fetch(`${API}/flights/${id}`);
  const body = await res.json();
  return body.data;
}

// Reset the flight to a known number of seats before each run (not concurrent).
async function resetSeats(id, seats) {
  const res = await fetch(`${API}/flights/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalSeats: seats }),
  });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

// ATOMIC: single conditional UPDATE server-side. Returns true if reserved.
async function reserveAtomic(id, seats) {
  const res = await fetch(`${API}/flights/${id}/seats/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seats }),
  });
  return res.status === 200; // 409 => insufficient seats
}

// NAIVE: read-modify-write across two calls. This is the buggy pattern.
async function reserveNaive(id, seats) {
  const flight = await getFlight(id);        // read
  if (flight.totalSeats < seats) return false;
  await fetch(`${API}/flights/${id}`, {      // write (no guard)
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalSeats: flight.totalSeats - seats }),
  });
  return true;
}

async function main() {
  console.log(`\n=== Seat concurrency test [mode=${MODE}] ===`);
  console.log(`flight=${FLIGHT_ID} seats=${SEATS} concurrency=${CONCURRENCY} per=${SEATS_PER_BOOKING}\n`);

  await resetSeats(FLIGHT_ID, SEATS);

  const reserve = MODE === 'naive' ? reserveNaive : reserveAtomic;

  // Fire all booking attempts at once — maximum contention.
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      reserve(FLIGHT_ID, SEATS_PER_BOOKING).catch(() => false)
    )
  );

  const successes = results.filter(Boolean).length;
  const seatsSold = successes * SEATS_PER_BOOKING;
  const finalFlight = await getFlight(FLIGHT_ID);
  const finalSeats = finalFlight.totalSeats;

  console.log(`Successful bookings : ${successes}`);
  console.log(`Seats sold          : ${seatsSold}`);
  console.log(`Seats available     : ${SEATS}`);
  console.log(`Final DB seat count : ${finalSeats}`);

  const oversold = seatsSold > SEATS || finalSeats < 0;
  console.log(`\nRESULT: ${oversold ? '❌ OVERSOLD (bug present)' : '✅ NO OVERSELLING (invariant held)'}`);
  console.log(oversold
    ? `  Sold ${seatsSold} seats but only ${SEATS} existed, and/or seat count went negative (${finalSeats}).`
    : `  Sold exactly ${seatsSold}/${SEATS}; the other ${CONCURRENCY - successes} attempts were correctly rejected.`);

  process.exit(oversold ? 1 : 0);
}

main().catch((err) => {
  console.error('Load test failed to run:', err.message);
  console.error('Is FlightsAndSearchService running on', BASE, '?');
  process.exit(2);
});
