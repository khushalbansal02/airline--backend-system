const axios = require('axios');
const moment = require('moment');
const OutboxRepository = require('../repository/outbox-repository');
const { createChannel, publishMessage } = require('./messageQueue');
const { AUTH_SERVICE_PATH, REMINDER_BINDING_KEY } = require('../config/server-config');

/**
 * Outbox relay (JOURNAL 1.4).
 *
 * Polls the Outboxes table for PENDING events, publishes each to RabbitMQ, and
 * marks it PUBLISHED. Because the event was written in the same transaction as
 * the booking, "the booking is confirmed" and "an event exists to publish" are
 * atomic. The relay guarantees AT-LEAST-ONCE delivery: if publishing fails, the
 * row stays PENDING and is retried on the next tick. Consumers must therefore be
 * idempotent (which is fine — duplicates are cheap to ignore).
 *
 * Note: HTTP calls (resolving the user's email) happen HERE, at publish time —
 * never inside the DB transaction — so the transaction stays fast and local.
 */
const outboxRepository = new OutboxRepository();
let channel = null;

async function getChannel() {
  if (!channel) channel = await createChannel();
  return channel;
}

async function buildNotification(event) {
  const { bookingId, userId } = event;
  let recipientEmail = null;
  try {
    const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/user/${userId}`);
    recipientEmail = userRes.data?.data?.email || null;
  } catch (e) {
    // If auth is down we can't resolve the email; leaving the row PENDING means
    // we retry later instead of publishing an undeliverable message.
    throw new Error(`could not resolve email for user ${userId}: ${e.message}`);
  }
  return {
    subject: 'Your flight booking is confirmed',
    content: `Booking #${bookingId} is confirmed. Thank you for flying with us.`,
    recepientEmail: recipientEmail,
    notificationTime: moment().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  };
}

async function processPending() {
  const pending = await outboxRepository.findPending(20);
  for (const row of pending) {
    try {
      const event = JSON.parse(row.payload);
      if (row.eventType === 'BOOKING_CONFIRMED') {
        const notification = await buildNotification(event);
        const ch = await getChannel();
        await publishMessage(ch, REMINDER_BINDING_KEY, JSON.stringify(notification));
      }
      await outboxRepository.markPublished(row.id, new Date());
    } catch (e) {
      // Leave PENDING; it will be retried next tick (at-least-once).
      console.log(`outbox relay: failed to publish event ${row.id}, will retry:`, e.message);
    }
  }
}

function startOutboxRelay(intervalMs = 5000) {
  console.log(`outbox relay started (polling every ${intervalMs}ms)`);
  setInterval(() => {
    processPending().catch((e) => console.log('outbox relay tick failed:', e.message));
  }, intervalMs);
}

module.exports = { startOutboxRelay, processPending };
