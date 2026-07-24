const axios = require('axios');
const { BookingRepository } = require('../repository/index');
const { FLIGHT_SERVICE_PATH } = require('../config/server-config');

/**
 * Booking auto-expiry sweeper (JOURNAL 1.5).
 *
 * A booking is created as InProcess and only becomes Booked once the saga
 * finishes. If the process crashes mid-saga (after reserving seats, before
 * confirming), the booking is left InProcess and its seats are held forever —
 * a slow seat leak. This periodic sweeper reclaims those orphaned holds:
 *
 *   for each InProcess booking older than the hold TTL:
 *     if it actually reserved seats -> release them in the flight service
 *     mark the booking Cancelled
 *
 * CORRECTNESS: we only release seats when seatsReserved === true. Releasing a
 * booking that crashed *before* reserving would wrongly inflate the seat count.
 */
const bookingRepository = new BookingRepository();

async function sweepExpiredHolds(ttlMinutes) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
  const expired = await bookingRepository.findExpiredHolds(cutoff);

  for (const booking of expired) {
    try {
      if (booking.seatsReserved) {
        await axios.post(
          `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}/seats/release`,
          { seats: booking.noofSeats }
        );
      }
      await bookingRepository.updateBooking(booking.id, {
        status: 'Cancelled',
        seatsReserved: false,
      });
      console.log(`sweeper: expired hold booking #${booking.id} cancelled, seats reclaimed`);
    } catch (e) {
      // Leave it for the next sweep; releasing/cancelling must be idempotent.
      console.log(`sweeper: failed to reclaim booking #${booking.id}, will retry:`, e.message);
    }
  }
  return expired.length;
}

function startBookingSweeper(ttlMinutes = 15, intervalMs = 60000) {
  console.log(`booking sweeper started (hold TTL ${ttlMinutes}m, every ${intervalMs}ms)`);
  setInterval(() => {
    sweepExpiredHolds(ttlMinutes).catch((e) =>
      console.log('booking sweeper tick failed:', e.message)
    );
  }, intervalMs);
}

module.exports = { startBookingSweeper, sweepExpiredHolds };
