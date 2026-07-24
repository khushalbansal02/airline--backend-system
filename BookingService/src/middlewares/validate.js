const { z } = require('zod');

/**
 * Schema-based request validation (JOURNAL 2.5).
 *
 * Validate untrusted input at the EDGE, before it reaches business logic, and
 * reject bad requests with a clear 400 listing exactly what's wrong. This is
 * both a correctness and a security control (never trust client input).
 */

// coerce so "2" (string from JSON/query) becomes the number 2, then constrain.
const positiveInt = z.coerce.number().int().positive();

const createBookingSchema = z.object({
  flightId: positiveInt,
  // Optional in the body: when the request comes through the gateway, the user
  // id is derived from the JWT (x-user-id) — the controller injects it and the
  // saga still enforces its presence (JOURNAL 3.3).
  userId: positiveInt.optional(),
  noofSeats: positiveInt.max(50).optional().default(1),
});

// Generic middleware: validates req.body against a schema, replaces it with the
// parsed (coerced, defaulted) value, or returns 400 with field-level errors.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        data: {},
        err: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    req.body = { ...req.body, ...result.data };
    next();
  };
}

module.exports = { validateBody, createBookingSchema };
