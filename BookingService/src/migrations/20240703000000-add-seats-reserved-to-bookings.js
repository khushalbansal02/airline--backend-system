'use strict';

const { DataTypes } = require('sequelize');

/**
 * Tracks whether a booking has actually reserved seats in the flight service
 * (JOURNAL 1.5). The auto-expiry sweeper needs this: it must release seats ONLY
 * for orphaned holds that truly reserved them. Releasing seats for a booking
 * that crashed *before* reserving would wrongly inflate the seat count.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Bookings', 'seatsReserved', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Bookings', 'seatsReserved');
  },
};
