# Welcome to Flights Service

## Project Setup
- clone the project on your local
- Execute `npm install` on the same path as of your root directory of teh downloaded project
- Create a `.env` file in the root directory and add the following environment variable
    - `PORT=3000`
- Inside the `src/config` folder create a new file `config.json` and then add the following piece of json

```
{
  "development": {
    "username": <YOUR_DB_LOGIN_NAME>,
    "password": <YOUR_DB_PASSWORD>,
    "database": "Flights_Search_DB_DEV",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}

```
- Once you've added your db config as listed above, go to the src folder from your terminal and execute `npx sequelize db:create`
```

## DB Design
  - Airplane Table
  - Flight
  - Airport
  - City 

  - A flight belongs to an airplane but one airplane can be used in multiple flights
  - A city has many airports but one airport belongs to a city
  - One airport can have many flights, but a flight belongs to one airport

  - for creating the model use the command
  ' npx sequelize db:generate --name <model name> --attributes <attributes>'
  example for the same
  'npx sequelize db:generate --name Airplanes --attributes modelname:String,capacity:integer'

  to migrate the changes run the command
  ' npx sequelize db:migrate'

  - code for generating the seed
  'npx sequelize seed:generate --name add-airplanes'

## API Endpoints

### `POST /api/v1/airplanes`
- Description: Create an airplane.
- Request headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "modelNumber": "Boeing 797",
    "capacity": 378
  }
  ```
- Response: `200` with airplane object.

### `PATCH /api/v1/airplanes/:id`
- Description: Update airplane capacity or details.
- Request headers: `Content-Type: application/json`
- Request body example:
  ```json
  {
    "capacity": 400
  }
  ```
- Response: `200` with updated airplane data.

### `POST /api/v1/flights`
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
- Notes: the middleware validates required fields and the service derives flight seat capacity from the selected airplane.
