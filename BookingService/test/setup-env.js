// Provide the env vars the config module requires, so importing service code
// under test doesn't trip the startup config guard. Runs before test modules load.
process.env.PORT = process.env.PORT || '3002';
process.env.FLIGHT_SERVICE_PATH = process.env.FLIGHT_SERVICE_PATH || 'http://flight.test';
process.env.AUTH_SERVICE_PATH = process.env.AUTH_SERVICE_PATH || 'http://auth.test';
process.env.EXCHANGE_NAME = process.env.EXCHANGE_NAME || 'airline_exchange';
process.env.REMINDER_BINDING_KEY = process.env.REMINDER_BINDING_KEY || 'reminder_key';
process.env.MESSAGE_BROKER_URL = process.env.MESSAGE_BROKER_URL || 'amqp://localhost';
