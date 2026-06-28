'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Users', [
      {
        email: 'test@example.com',
        password: 'password123',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: 'admin@example.com',
        password: 'adminpass123',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', {
      email: ['test@example.com', 'admin@example.com']
    }, {});
  }
};
