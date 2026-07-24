const { BookingRepository } = require('../repository/index');
const axios = require('axios');
const { FLIGHT_SERVICE_PATH, AUTH_SERVICE_PATH, REMINDER_BINDING_KEY } = require('../config/server-config');
const { createChannel, publishMessage } = require('../utils/messageQueue');
const AppError = require('../utils/app-error');
const moment = require('moment');

class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
  }

  /**
   * Create a booking using the SAGA pattern (JOURNAL 1.2).
   *
   * We cannot wrap this in a single ACID transaction because seat inventory
   * lives in a DIFFERENT service and database. So we run a sequence of local
   * steps, and if any step fails we execute COMPENSATING actions in reverse
   * order to undo the earlier steps — leaving the system consistent. This is
   * "eventual consistency via orchestrated compensation".
   *
   *   Step 1: create booking (InProcess)      → compensate: cancel booking
   *   Step 2: reserve seats (atomic, remote)   → compensate: release seats
   *   Step 3: confirm booking (Booked)         → terminal success
   */
  createBooking = async (data) => {
    const compensations = []; // LIFO stack of undo actions

    try {
      // ---- validate input ----
      const seats = Number(data.noofSeats) || 1;
      if (!data.flightId || !data.userId) {
        throw new AppError('flightId and userId are required', 400);
      }
      if (!Number.isInteger(seats) || seats <= 0) {
        throw new AppError('noofSeats must be a positive integer', 400);
      }

      // ---- idempotency: replay protection (JOURNAL 1.3) ----
      // If this request carries a key we've already processed, return the
      // existing booking instead of creating a second one. This makes safe
      // client retries and accidental double-clicks harmless.
      const idempotencyKey = data.idempotencyKey || null;
      if (idempotencyKey) {
        const existing = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          return existing;
        }
      }

      // ---- fetch flight for pricing (the authoritative seat check is step 2) ----
      let flightData;
      try {
        const res = await axios.get(`${FLIGHT_SERVICE_PATH}/api/v1/flights/${data.flightId}`);
        flightData = res.data.data;
      } catch (e) {
        throw new AppError(`Flight service unavailable or flight ${data.flightId} not found`, 502);
      }
      if (!flightData) {
        throw new AppError(`Flight ${data.flightId} not found`, 404);
      }
      const totalCost = flightData.price * seats;

      // ---- Step 1: create booking as InProcess ----
      // If two concurrent requests share an idempotencyKey and both pass the
      // check above, the UNIQUE constraint makes the second create() throw —
      // we catch that specific case and return the winner's booking.
      let booking;
      try {
        booking = await this.bookingRepository.create({
          flightId: data.flightId,
          userId: data.userId,
          noofSeats: seats,
          totalCost,
          status: 'InProcess',
          idempotencyKey,
        });
      } catch (e) {
        if (idempotencyKey && e.name === 'SequelizeUniqueConstraintError') {
          const existing = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
          if (existing) return existing;
        }
        throw e;
      }
      compensations.push(() =>
        this.bookingRepository.updateBooking(booking.id, { status: 'Cancelled' })
      );

      // ---- Step 2: reserve seats atomically in the flight service ----
      // 409 => not enough seats. We accept it as a valid (non-throwing) HTTP
      // response so we can convert it into a domain error deliberately.
      const reserveRes = await axios.post(
        `${FLIGHT_SERVICE_PATH}/api/v1/flights/${data.flightId}/seats/reserve`,
        { seats },
        { validateStatus: (s) => s === 200 || s === 409 }
      );
      if (reserveRes.status === 409) {
        throw new AppError('Insufficient seats available', 409);
      }
      compensations.push(() =>
        axios.post(`${FLIGHT_SERVICE_PATH}/api/v1/flights/${data.flightId}/seats/release`, { seats })
      );

      // ---- Step 3: confirm booking ----
      const finalBooking = await this.bookingRepository.updateBooking(booking.id, {
        status: 'Booked',
      });

      // ---- best-effort notification (made reliable via Outbox in JOURNAL 1.3) ----
      // A failed email must NOT cancel a confirmed, paid booking, so this is
      // isolated from the saga's compensation flow.
      await this.publishBookingConfirmed(data.userId, booking.id).catch((e) =>
        console.log('notification publish failed (booking still succeeded):', e.message)
      );

      return finalBooking;
    } catch (error) {
      // Unwind the saga: run compensations in REVERSE order.
      for (const compensate of compensations.reverse()) {
        try {
          await compensate();
        } catch (ce) {
          // A failed compensation is serious — in production this would alert
          // and/or go to a reconciliation queue. We log loudly and continue.
          console.log('compensation step failed:', ce.message);
        }
      }
      throw error;
    }
  };

  publishBookingConfirmed = async (userId, bookingId) => {
    const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/user/${userId}`);
    const userEmail = userRes.data.data.email;
    const notifyAt = moment().add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    const channel = await createChannel();
    const payload = {
      subject: 'Your flight booking is confirmed',
      content: `Booking #${bookingId} is confirmed. Thank you for flying with us.`,
      recepientEmail: userEmail,
      notificationTime: notifyAt,
    };
    await publishMessage(channel, REMINDER_BINDING_KEY, JSON.stringify(payload));
  };
}

module.exports = BookingService;
