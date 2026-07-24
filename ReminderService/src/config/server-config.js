const dotenv = require('dotenv');
dotenv.config();

// Fail loudly at startup if a required config value is missing, instead of
// discovering it as a silent runtime failure (see ENGINEERING_JOURNAL 0.1).
const required = ['PORT', 'EXCHANGE_NAME', 'REMINDER_BINDING_KEY', 'MESSAGE_BROKER_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`ReminderService missing required env vars: ${missing.join(', ')}`);
}

module.exports = {
  PORT: process.env.PORT,
  EMAIL_ID: process.env.EMAIL_ID,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EXCHANGE_NAME: process.env.EXCHANGE_NAME,
  REMINDER_BINDING_KEY: process.env.REMINDER_BINDING_KEY,
  MESSAGE_BROKER_URL: process.env.MESSAGE_BROKER_URL,
};

