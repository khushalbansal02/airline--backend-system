-- Seed ~5000 synthetic flights so the search benchmark reflects a realistic
-- dataset (JOURNAL 3.1). Run against flights_service_dev, then run:
--   node loadtest/search-benchmark.js --n=3000 --concurrency=50
-- Clean up afterwards with:
--   DELETE FROM Flights WHERE flightNumber LIKE 'BENCH%';

SET SESSION cte_max_recursion_depth = 100000;

INSERT INTO Flights
  (flightNumber, airplaneId, departureAirportId, arrivalAirportId,
   arrivalTime, departureTime, price, totalSeats, createdAt, updatedAt)
SELECT CONCAT('BENCH', n), 1, 1, 2,
       NOW() + INTERVAL 3 HOUR, NOW(), 3000 + n, 200, NOW(), NOW()
FROM (
  WITH RECURSIVE seq(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5000
  )
  SELECT n FROM seq
) t;
