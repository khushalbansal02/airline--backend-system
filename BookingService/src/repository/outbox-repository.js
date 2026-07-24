const { Outbox } = require('../models/index');

class OutboxRepository {
  // Insert an event. `options` carries the { transaction } so this write
  // commits atomically with the booking state change (JOURNAL 1.4).
  async create(eventType, payload, options = {}) {
    try {
      return await Outbox.create(
        { eventType, payload: JSON.stringify(payload), status: 'PENDING' },
        options
      );
    } catch (error) {
      console.log('something went wrong writing to the outbox');
      throw error;
    }
  }

  // The relay reads a small batch of unpublished events, oldest first.
  async findPending(limit = 20) {
    try {
      return await Outbox.findAll({
        where: { status: 'PENDING' },
        order: [['id', 'ASC']],
        limit,
      });
    } catch (error) {
      console.log('something went wrong reading pending outbox events');
      throw error;
    }
  }

  async markPublished(id, publishedAt) {
    try {
      return await Outbox.update(
        { status: 'PUBLISHED', publishedAt },
        { where: { id } }
      );
    } catch (error) {
      console.log('something went wrong marking outbox event published');
      throw error;
    }
  }
}

module.exports = OutboxRepository;
