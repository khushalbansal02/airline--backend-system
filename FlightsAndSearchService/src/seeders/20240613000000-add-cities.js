'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Cities', [
      {
        name: 'Bangalore',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Delhi',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mysore',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Cities', {
      name: ['Bangalore', 'Delhi', 'Mysore']
    }, {});
  }
};
