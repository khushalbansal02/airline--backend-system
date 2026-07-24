const dotenv=require('dotenv')
dotenv.config();

// Fail loudly at startup if required config is missing (JOURNAL 0.1 / 0.6)
const required = ['PORT', 'FLIGHT_SERVICE_PATH', 'AUTH_SERVICE_PATH', 'EXCHANGE_NAME', 'REMINDER_BINDING_KEY', 'MESSAGE_BROKER_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`BookingService missing required env vars: ${missing.join(', ')}`);
}

module.exports={
  PORT:process.env.PORT,
  DB_SYNC:process.env.DB_SYNC,
  FLIGHT_SERVICE_PATH:process.env.FLIGHT_SERVICE_PATH,
  AUTH_SERVICE_PATH:process.env.AUTH_SERVICE_PATH,
  EXCHANGE_NAME :process.env.EXCHANGE_NAME
  , REMINDER_BINDING_KEY:process.env.REMINDER_BINDING_KEY,
  MESSAGE_BROKER_URL:process.env.MESSAGE_BROKER_URL,

}