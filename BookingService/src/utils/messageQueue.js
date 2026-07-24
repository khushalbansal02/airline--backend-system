const amqplib = require('amqplib');
const { EXCHANGE_NAME, MESSAGE_BROKER_URL } = require('../config/server-config');

/**
 * Message-broker helpers (JOURNAL 2.2).
 *
 * durable exchange + persistent messages => events survive a broker restart.
 * (Previously the exchange was non-durable and messages non-persistent, so a
 * RabbitMQ restart silently dropped everything in flight.)
 */
const createChannel = async () => {
  try {
    const connection = await amqplib.connect(MESSAGE_BROKER_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
    return channel;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const publishMessage = async (channel, bindingKey, message) => {
  try {
    // persistent:true asks the broker to write the message to disk, so it is
    // not lost if the broker restarts before a consumer reads it.
    channel.publish(EXCHANGE_NAME, bindingKey, Buffer.from(message), {
      persistent: true,
    });
  } catch (error) {
    throw error;
  }
};

module.exports = { createChannel, publishMessage };
