'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Flights', [
      {
        flightNumber: 'AI101',
        airplaneId: 1,
        departureAirportId: 1,
        arrivalAirportId: 2,
        departureTime: '2025-12-01 10:00:00',
        arrivalTime: '2025-12-01 13:00:00',
        price: 500,
        boardingGate: 'A1',
        totalSeats: 300,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        flightNumber: 'AI102',
        airplaneId: 2,
        departureAirportId: 3,
        arrivalAirportId: 4,
        departureTime: '2025-12-02 08:00:00',
        arrivalTime: '2025-12-02 11:00:00',
        price: 450,
        boardingGate: 'B2',
        totalSeats: 350,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Flights', {
      flightNumber: ['AI101', 'AI102']
    }, {});
  }
};
