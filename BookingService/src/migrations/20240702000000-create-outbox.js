'use strict';

/**
 * Transactional Outbox table (JOURNAL 1.4).
 *
 * Events are inserted here in the SAME local transaction that changes booking
 * state, so the state change and the "intent to publish" commit atomically.
 * A background relay then publishes PENDING rows to the message broker and
 * marks them PUBLISHED. This defeats the dual-write problem: we never lose an
 * event because of a crash between "commit DB" and "publish to broker".
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Outboxes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      eventType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payload: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PUBLISHED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      publishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
    // The relay polls by status; index it so the poll stays cheap as the table grows.
    await queryInterface.addIndex('Outboxes', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Outboxes');
  },
};
