# Airline Booking System API Flow

This document describes every API endpoint in the repository, including request paths, headers, request body shape, response shape, and flow through services.

## 1. API Gateway

### `GET /home`
- Description: Basic health route for the gateway.
- Request headers: none
- Request body: none
- Response:
  - `200` with `{ hello: "hi" }`

### `POST /bookingservice/*`
- Description: Gateway proxy path to `BookingService`.
- Authentication: requires `x-access-token` header.
- Gateway flow:
  1. Request arrives at `API_Gateway` under `/bookingservice`.
  2. Gateway forwards auth request to `AuthService`:
     - `GET http://localhost:3001/api/v1/isAuthenticated`
     - Header: `x-access-token`
  3. If auth succeeds, request proxies to `BookingService` at `http://localhost:3002/`.
  4. Response returns back through the gateway.

> Note: The gateway only uses `/bookingservice` for booking service proxying.

## 2. AuthService

Base URL: `http://localhost:3001/api/v1`

### `POST /signup`
- Description: Register a new user.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- Response:
  - `200` success with JSON:
    ```json
    {
      "success": true,
      "data": { "id": 1, "email": "user@example.com", ... },
      "err": {},
      "message": "successfully create the new user"
    }
    ```
- Flow:
  1. `user-controller.create` receives body.
  2. `user-service.create` calls `user-repository.create`.
  3. `User` model hashes password before create.
  4. Created user returns to controller.

### `POST /signin`
- Description: Login existing user and receive JWT.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- Response:
  - `200` success with JSON:
    ```json
    {
      "data": "<jwt_token>"
    }
    ```
- Flow:
  1. `user-controller.signIn` receives credentials.
  2. `user-service.signIn` fetches user by email.
  3. Password comparison via bcrypt.
  4. JWT token created with `JWT_KEY`.

### `GET /isAuthenticated`
- Description: Validate JWT token.
- Request headers:
  - `x-access-token`: JWT returned from `/signin`
- Request body: none
- Response:
  - `200` success with JSON:
    ```json
    {
      "success": true,
      "data": 1,
      "message": "user is authenticated and token is valid",
      "err": {}
    }
    ```
- Flow:
  1. `user-controller.isAuthenticated` reads `x-access-token`.
  2. `user-service.isAuthenticated` verifies JWT.
  3. `user-repository.getById` checks the user exists.
  4. Returns the user id.

### `GET /isAdmin`
- Description: Intended admin check endpoint.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "id": 1
  }
  ```
- Response:
  - `200` success with JSON indicating whether the user has admin role.
- Flow:
  1. `user-controller.isAdmin` forwards `id` to `user-service.isAdmin`.
  2. `user-repository.isAdmin` checks user's `Role` association.

> Note: The route in code is defined as `router.get('isAdmin', ...)`, missing a leading slash. The intended path is `/isAdmin`, but the current code may not register the route correctly.

### `GET /user/:id`
- Description: Fetch user by ID.
- Request headers: none
- Response:
  - `200` with user details.
- Flow:
  1. `user-controller.getbyId` calls `user-service.getById`.
  2. `user-repository.getById` returns user record.

## 3. BookingService

Base URL: `http://localhost:3002/api/v1`

### `POST /bookings`
- Description: Create a booking and trigger notification flow.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "flightId": 1,
    "userId": 1,
    "noofSeats": 2
  }
  ```
- Response:
  - `200` success with booking details.
- Flow:
  1. `BookingController.create` receives booking data.
  2. `BookingService.createBooking` starts a Sequelize transaction.
  3. It looks up the flight via `FLIGHT_SERVICE_PATH`:
     - `GET http://localhost:3003/api/v1/flights/:flightId`
  4. It validates seat availability.
  5. Creates a booking record in local DB.
  6. Sends an update to flight service:
     - `PATCH http://localhost:3003/api/v1/flights/:flightId`
     - body `{ "totalSeats": remainingSeats }`
  7. Marks booking status as `Booked`.
  8. Fetches user email via AuthService:
     - `GET http://localhost:3001/api/v1/user/:userId`
  9. Publishes a notification message to RabbitMQ.
  10. Returns booking data.

### `POST /publish`
- Description: Test endpoint to publish a dummy message to RabbitMQ.
- Request headers: none
- Request body: none
- Response:
  - `200` with message success.
- Flow:
  1. Creates a RabbitMQ channel.
  2. Publishes a hard-coded notification payload to `REMINDER_BINDING_KEY`.

### `GET /hi`
- Description: Simple test route.
- Response:
  - `200` with `{ "hi": "bro" }`

## 4. FlightsAndSearchService

Base URL: `http://localhost:3003/api/v1`

### `POST /city`
- Description: Create a new city.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "name": "Bangalore"
  }
  ```
- Response: `201` with created city.
- Flow:
  1. `city-controller.create` forwards body to `CityService.createCity`.
  2. `CityRepository.createCity` persists city.

### `DELETE /city/:id`
- Description: Delete a city.
- Request headers: none
- Response: `200` with deletion result.
- Flow:
  1. `city-controller.destroy` calls `CityService.deleteCity`.
  2. `CityRepository.deleteCity` deletes by primary key.

### `GET /city/:id`
- Description: Fetch city by ID.
- Request headers: none
- Response: `200` with city data.

### `PATCH /city/:id`
- Description: Update city fields.
- Request headers: `Content-Type: application/json`
- Request body example:
  ```json
  {
    "name": "New City Name"
  }
  ```
- Response: `200` with updated city.

### `GET /city`
- Description: List cities, optionally filtered by name.
- Request query params:
  - `name` (optional)
- Example: `/api/v1/city?name=Bangalore`
- Response: `200` with city list.

### `POST /flights`
- Description: Create a flight.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "flightNumber": "AI123",
    "airplaneId": 1,
    "departureAirportId": 1,
    "arrivalAirportId": 2,
    "departureTime": "2025-12-01 10:00:00",
    "arrivalTime": "2025-12-01 13:00:00",
    "price": 500
  }
  ```
- Response: `200` with flight data.
- Flow:
  1. `FlightMiddlewares.validateCreateFlight` validates date/time.
  2. `flight-controller.create` calls `FlightService.createflight`.
  3. It fetches airplane capacity from `AirplaneRepository.getAirplane`.
  4. Creates a flight record with `totalSeats` from airplane capacity.

### `PATCH /flights/:id`
- Description: Update flight fields.
- Request headers: `Content-Type: application/json`
- Body example:
  ```json
  {
    "price": 550
  }
  ```
- Response: `200` with `true` or updated result.
- Flow:
  1. `flight-controller.update` calls `FlightService.updateFlight`.
  2. `FlightRepository.updateFlight` executes the update.

### `GET /flights/:id`
- Description: Get flight details by ID.
- Response: `200` with flight object.

### `GET /flights`
- Description: Search flights with filters.
- Query params supported:
  - `departureAirportId`
  - `arrivalAirportId`
  - `minprice`
  - `maxprice`
- Example: `/api/v1/flights?departureAirportId=1&maxprice=1000`
- Response: `200` with flight list.
- Flow:
  1. `flight-controller.getAll` forwards query to `FlightService.getAllFlightData`.
  2. `FlightRepository.getAllFlights` builds Sequelize filter and returns matching flights.

### `POST /airports`
- Description: Create a new airport.
- Request body:
  ```json
  {
    "name": "Kempegowda International Airport",
    "cityId": 1
  }
  ```
- Response: `201` with created airport.

## 5. ReminderService

Base URL: `http://localhost:3004`

### `POST /api/v1/tickets`
- Description: Create a reminder ticket record.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "subject": "Booking confirmed",
    "content": "Your ticket is booked.",
    "recepientEmail": "user@example.com",
    "notificationTime": "2025-12-02 09:00:00"
  }
  ```
- Response: `200` with ticket data.
- Flow:
  1. `ticket-controller.create` forwards body to `email-service.createNotification`.
  2. `ticket-repository.create` saves the notification ticket.

### RabbitMQ Consumer
- On startup, `ReminderService` opens a RabbitMQ channel.
- It subscribes with `REMINDER_BINDING_KEY`.
- Received messages are logged and acknowledged.
- A background cron job checks pending tickets every minute and sends email via Nodemailer.

## 6. Project API Flow Summary

### Authentication flow
1. Client calls `POST /api/v1/signin`.
2. AuthService returns JWT.
3. Client calls gateway `/bookingservice/api/v1/bookings` with `x-access-token`.
4. Gateway validates token with AuthService.
5. If valid, the booking request proceeds.

### Booking creation flow
1. Client sends booking request to `BookingService`.
2. BookingService fetches flight details from FlightsService.
3. It validates seat inventory.
4. Creates booking record in BookingService DB.
5. Updates flight seats in FlightsService.
6. Fetches user email from AuthService.
7. Publishes notification payload to RabbitMQ.
8. ReminderService consumes the message and inserts a reminder ticket.
9. Cron job sends the email when notification time arrives.

### Flight / City / Airport flow
- City and airport creates go directly to FlightsAndSearchService.
- Flight creation is validated by middleware, uses airplane capacity, and stores flight metadata.
- Flight search uses query params and returns matches from the `Flights` table.

## 7. Headers and Body Templates

### `x-access-token`
- Required for all gateway-proxied booking requests.
- Provided by AuthService after login.

### Common request bodies
- Signup:
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- Signin:
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- Booking:
  ```json
  { "flightId": 1, "userId": 1, "noofSeats": 2 }
  ```
- Airplane create:
  ```json
  {
    "modelNumber": "Boeing 797",
    "capacity": 378
  }
  ```
- Flight create:
  ```json
  {
    "flightNumber": "AI123",
    "airplaneId": 1,
    "departureAirportId": 1,
    "arrivalAirportId": 2,
    "departureTime": "2025-12-01 10:00:00",
    "arrivalTime": "2025-12-01 13:00:00",
    "price": 500
  }
  ```
- City create:
  ```json
  { "name": "Bangalore" }
  ```
- Airport create:
  ```json
  { "name": "Kempegowda International Airport", "cityId": 1 }
  ```
- Reminder ticket:
  ```json
  {
    "subject": "Booking confirmed",
    "content": "Your ticket is booked.",
    "recepientEmail": "user@example.com",
    "notificationTime": "2025-12-02 09:00:00"
  }
  ```

## 8. Seeded Dummy Data and Test Access Token
### Seeded data available for testing
- AuthService:
  - `test@example.com` / `password123`
  - `admin@example.com` / `adminpass123`
  - Roles seeded include `ADMIN`, `COSTUMER`, and `AIRLINE_BUSINESS`.
- FlightsAndSearchService:
  - Cities: `Bangalore` (id=1), `Delhi` (id=2), `Mysore` (id=3)
  - Airports: `Kempegowda International Airport` (cityId=1), `Indira Gandhi International Airport` (cityId=2)
  - Airplanes: `Boeing 737`, `Airbus A320`, `Boeing 777`, `Airbus A330`, `Airbus A380`
  - Flights:
    - `AI101`: airplaneId=1, departureAirportId=1, arrivalAirportId=2, departureTime=`2025-12-01 10:00:00`, arrivalTime=`2025-12-01 13:00:00`, price=500
    - `AI102`: airplaneId=2, departureAirportId=3, arrivalAirportId=4, departureTime=`2025-12-02 08:00:00`, arrivalTime=`2025-12-02 11:00:00`, price=450
- BookingService:
  - Booking 1: flightId=1, userId=1, status=`Booked`, noofSeats=2, totalCost=1000
  - Booking 2: flightId=2, userId=1, status=`InProcess`, noofSeats=1, totalCost=500
- ReminderService:
  - Notification tickets seeded for `test@example.com` with `PENDING` status and scheduled notification times.

### Getting a test access token
1. Send `POST` to `http://localhost:3001/api/v1/signin`
2. Request body:
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
3. The response returns a JWT in `data`.
4. Use that JWT for booking requests through the API Gateway:
  - Header: `x-access-token: <jwt_token>`
  - Example: `POST http://localhost:3000/bookingservice/api/v1/bookings`

### Example seeded booking flow
- Use `test@example.com` to sign in and get a token.
- Create a booking for flight `AI101` with `noofSeats=2`.
- BookingService validates the flight and updates seat inventory.
- BookingService publishes a RabbitMQ notification.
- ReminderService consumes the message and creates a reminder ticket.

## 9. Notes
- The gateway is currently configured only for BookingService proxying.
- Many service endpoints are not protected by auth besides the booking gateway path.
- `ReminderService` uses RabbitMQ and email sending via Gmail SMTP.
- `BookingService` expects `FLIGHT_SERVICE_PATH` and `REMINDER_BINDING_KEY` to be configured.

---

This file documents every endpoint and the request flow for the current repository implementation.
