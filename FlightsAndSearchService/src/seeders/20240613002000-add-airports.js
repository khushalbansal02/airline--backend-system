'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Airports', [
      {
        name: 'Kempegowda International Airport',
        address: 'Bangalore, India',
        cityId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Indira Gandhi International Airport',
        address: 'New Delhi, India',
        cityId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Chennai International Airport',
        address: 'Chennai, India',
        cityId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Bengaluru International Terminal 2',
        address: 'Bangalore, India',
        cityId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Airports', {
      name: ['Kempegowda International Airport', 'Indira Gandhi International Airport']
    }, {});
  }
};
