// Unit tests for the booking Saga (JOURNAL 1.2–1.5).
// All dependencies are mocked, so these run fast anywhere — no DB, no RabbitMQ.

jest.mock('axios');
const axios = require('axios');

// Mock the models module so the service's `sequelize.transaction()` doesn't
// touch a real database. Each transaction is a no-op commit/rollback pair.
jest.mock('../src/models', () => ({
  sequelize: {
    transaction: jest.fn(async () => ({
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
    })),
  },
}));

const BookingService = require('../src/services/booking-service');

function makeRepos() {
  return {
    bookingRepository: {
      create: jest.fn(),
      updateBooking: jest.fn(async (id, data) => ({ id, ...data })),
      findByIdempotencyKey: jest.fn(),
    },
    outboxRepository: { create: jest.fn(async () => ({})) },
  };
}

const FLIGHT = { price: 100, totalSeats: 50 };

describe('BookingService.createBooking (Saga)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('happy path: reserves seats, confirms booking, writes outbox event', async () => {
    const repos = makeRepos();
    repos.bookingRepository.findByIdempotencyKey.mockResolvedValue(null);
    repos.bookingRepository.create.mockResolvedValue({ id: 1, flightId: 2 });
    axios.get.mockResolvedValue({ data: { data: FLIGHT } });
    axios.post.mockResolvedValue({ status: 200 });

    const svc = new BookingService(repos);
    const result = await svc.createBooking({ flightId: 2, userId: 3, noofSeats: 2 });

    // reserved the seats
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/seats/reserve'),
      { seats: 2 },
      expect.anything()
    );
    // wrote the outbox event atomically with confirmation
    expect(repos.outboxRepository.create).toHaveBeenCalledWith(
      'BOOKING_CONFIRMED',
      expect.objectContaining({ bookingId: 1, userId: 3, seats: 2 }),
      expect.anything()
    );
    // confirmed
    expect(result.status).toBe('Booked');
  });

  test('insufficient seats: returns 409 and compensates (cancel booking, no release)', async () => {
    const repos = makeRepos();
    repos.bookingRepository.findByIdempotencyKey.mockResolvedValue(null);
    repos.bookingRepository.create.mockResolvedValue({ id: 1, flightId: 2 });
    axios.get.mockResolvedValue({ data: { data: FLIGHT } });
    axios.post.mockResolvedValue({ status: 409 }); // reservation rejected

    const svc = new BookingService(repos);

    await expect(
      svc.createBooking({ flightId: 2, userId: 3, noofSeats: 999 })
    ).rejects.toMatchObject({ statusCode: 409 });

    // compensation cancelled the booking...
    expect(repos.bookingRepository.updateBooking).toHaveBeenCalledWith(1, { status: 'Cancelled' });
    // ...and did NOT try to release seats (reserve never succeeded)
    const releaseCalls = axios.post.mock.calls.filter(([url]) => url.includes('/release'));
    expect(releaseCalls).toHaveLength(0);
  });

  test('idempotent replay: returns the existing booking without creating a new one', async () => {
    const repos = makeRepos();
    repos.bookingRepository.findByIdempotencyKey.mockResolvedValue({ id: 7, status: 'Booked' });

    const svc = new BookingService(repos);
    const result = await svc.createBooking({
      flightId: 2,
      userId: 3,
      noofSeats: 1,
      idempotencyKey: 'key-123',
    });

    expect(result.id).toBe(7);
    expect(repos.bookingRepository.create).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('failure after reserve: compensations run in reverse (release seats, then cancel)', async () => {
    const repos = makeRepos();
    repos.bookingRepository.findByIdempotencyKey.mockResolvedValue(null);
    repos.bookingRepository.create.mockResolvedValue({ id: 1, flightId: 2 });
    // outbox write fails inside the confirm transaction -> triggers unwind
    repos.outboxRepository.create.mockRejectedValue(new Error('db down'));
    axios.get.mockResolvedValue({ data: { data: FLIGHT } });
    axios.post.mockResolvedValue({ status: 200 }); // reserve + release both ok

    const svc = new BookingService(repos);

    await expect(
      svc.createBooking({ flightId: 2, userId: 3, noofSeats: 2 })
    ).rejects.toThrow('db down');

    // released the reserved seats (compensation for step 2)
    const releaseCalls = axios.post.mock.calls.filter(([url]) => url.includes('/release'));
    expect(releaseCalls).toHaveLength(1);
    // cancelled the booking (compensation for step 1)
    expect(repos.bookingRepository.updateBooking).toHaveBeenCalledWith(1, { status: 'Cancelled' });
  });

  test('validation: rejects missing flightId/userId with 400', async () => {
    const repos = makeRepos();
    const svc = new BookingService(repos);
    await expect(svc.createBooking({ noofSeats: 1 })).rejects.toMatchObject({ statusCode: 400 });
    expect(repos.bookingRepository.create).not.toHaveBeenCalled();
  });
});
