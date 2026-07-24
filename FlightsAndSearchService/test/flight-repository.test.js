// Unit tests for atomic seat reservation (JOURNAL 1.1). The DB is mocked, so
// these assert the LOGIC: the conditional update's guard, and how we translate
// affected-row counts into "reserved" / "not enough seats".

jest.mock('../src/models/index', () => {
  const Flights = {
    update: jest.fn(),
    sequelize: { literal: (s) => s }, // pass-through stub
  };
  return { Flights };
});

const FlightRepository = require('../src/repository/flight-repository');
const { Flights } = require('../src/models/index');

describe('FlightRepository.reserveSeats (atomic)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('reserves when exactly one row is updated', async () => {
    Flights.update.mockResolvedValue([1]);
    const repo = new FlightRepository();

    await expect(repo.reserveSeats(1, 2)).resolves.toBe(true);

    // the WHERE clause must carry the seat guard so the decrement is conditional
    const [, opts] = Flights.update.mock.calls[0];
    expect(opts.where).toHaveProperty('id', 1);
    expect(opts.where).toHaveProperty('totalSeats'); // the >= n guard
  });

  test('does NOT reserve when no row matches (insufficient seats / lost race)', async () => {
    Flights.update.mockResolvedValue([0]);
    const repo = new FlightRepository();
    await expect(repo.reserveSeats(1, 5)).resolves.toBe(false);
  });

  test('rejects non-positive seat counts', async () => {
    const repo = new FlightRepository();
    await expect(repo.reserveSeats(1, 0)).rejects.toBeDefined();
    await expect(repo.reserveSeats(1, -3)).rejects.toBeDefined();
    expect(Flights.update).not.toHaveBeenCalled();
  });
});

describe('FlightRepository.releaseSeats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns true when the flight row is updated', async () => {
    Flights.update.mockResolvedValue([1]);
    const repo = new FlightRepository();
    await expect(repo.releaseSeats(1, 3)).resolves.toBe(true);
  });
});
