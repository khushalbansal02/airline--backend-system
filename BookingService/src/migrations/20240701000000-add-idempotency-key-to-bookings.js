'use strict';

const { DataTypes } = require('sequelize');

/**
 * Adds a unique idempotency key to bookings (JOURNAL 1.3).
 *
 * The UNIQUE constraint is what makes idempotency race-safe: even if two
 * concurrent requests carry the same key and both pass the "does it exist?"
 * check, the database will reject the second INSERT — so at most one booking
 * per key can ever exist.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Bookings', 'idempotencyKey', {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Bookings', 'idempotencyKey');
  },
};
