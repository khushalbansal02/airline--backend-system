const { BookingService } = require('../services/index');
const bookingService = new BookingService();

const create = async (req, res) => {
  try {
    // Standard header for idempotent APIs (Stripe, etc.). Falls back to a body
    // field so it's easy to test from any client (JOURNAL 1.3).
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const response = await bookingService.createBooking({
      ...req.body,
      idempotencyKey,
      correlationId: req.correlationId,
    });
    return res.status(201).json({
      success: true,
      data: response,
      message: 'Successfully booked the flight',
      err: {},
    });
  } catch (error) {
    // Map the AppError's statusCode (409 for no seats, 404, 400, 502…) instead
    // of returning 400 for everything (JOURNAL 0.4 / 1.2).
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      data: {},
      message: error.message || 'Unable to book the flight',
      err: error.message || error,
    });
  }
};

module.exports = { create };
