'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Bookings', [
      {
        flightId: 1,
        userId: 1,
        status: 'Booked',
        noofSeats: 2,
        totalCost: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        flightId: 2,
        userId: 1,
        status: 'InProcess',
        noofSeats: 1,
        totalCost: 500,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Bookings', null, {});
  }
};
