const amqplib = require('amqplib');
const { EXCHANGE_NAME, MESSAGE_BROKER_URL } = require('../config/server-config');

/**
 * Reliable messaging with a Dead-Letter Queue (JOURNAL 2.2).
 *
 * Topology:
 *   airline_events (durable direct exchange)
 *      -> reminder_queue (durable, dead-letters to the DLX)
 *   airline_events.dlx (durable fanout exchange)
 *      -> reminder_dlq (durable) — parks messages the consumer couldn't process
 *
 * A "poison" message (bad JSON, a bug, a permanently-failing side effect) would
 * otherwise be redelivered forever or silently dropped. Instead we nack it
 * without requeue, and RabbitMQ routes it to the DLQ for later inspection/replay.
 */
const MAIN_QUEUE = 'reminder_queue';
const DLX_NAME = `${EXCHANGE_NAME}.dlx`;
const DLQ_NAME = 'reminder_dlq';

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

const subscribeMessage = async (channel, service, bindingKey) => {
  // Dead-letter exchange + queue for messages we can't process.
  await channel.assertExchange(DLX_NAME, 'fanout', { durable: true });
  await channel.assertQueue(DLQ_NAME, { durable: true });
  await channel.bindQueue(DLQ_NAME, DLX_NAME, '');

  // Main durable queue; failed messages dead-letter to the DLX.
  await channel.assertQueue(MAIN_QUEUE, {
    durable: true,
    deadLetterExchange: DLX_NAME,
  });
  await channel.bindQueue(MAIN_QUEUE, EXCHANGE_NAME, bindingKey);

  // Process one unacked message at a time for fair, backpressure-friendly work.
  channel.prefetch(1);

  channel.consume(MAIN_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      await service(data); // only ack AFTER the work succeeds
      channel.ack(msg);
    } catch (error) {
      // Don't requeue (would loop forever on a poison message) — nack sends it
      // to the DLQ via the queue's dead-letter-exchange.
      console.log('consumer failed, dead-lettering message:', error.message);
      channel.nack(msg, false, false);
    }
  });
};

const publishMessage = async (channel, bindingKey, message) => {
  try {
    channel.publish(EXCHANGE_NAME, bindingKey, Buffer.from(message), {
      persistent: true,
    });
  } catch (error) {
    throw error;
  }
};

module.exports = { subscribeMessage, createChannel, publishMessage };
