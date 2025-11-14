'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
   await queryInterface.bulkInsert('Airports',[
    
    {
      name:'kampegowda international airport',
      cityId:7,
      createdAt:new Date(),
      updatedAt:new Date(),
    },
    {
      name:' Mysuru airport',
      cityId:7,
      createdAt:new Date(),
      updatedAt:new Date(),
  },
  {
      name:'Mengaluru international airport',
      cityId:7,
      createdAt:new Date(),
      updatedAt:new Date(),
  },
  {
    name:'Indira gandhi international airport',
    cityId:5,
    createdAt:new Date(),
    updatedAt:new Date(),
  }
   ],{})
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
