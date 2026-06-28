'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('NotificationTickets', [
      {
        subject: 'Booking confirmed',
        content: 'Your flight has been booked successfully.',
        recepientEmail: 'test@example.com',
        status: 'PENDING',
        notificationTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        subject: 'Reminder: upcoming flight',
        content: 'Your flight is scheduled in 24 hours.',
        recepientEmail: 'test@example.com',
        status: 'PENDING',
        notificationTime: new Date(new Date().getTime() + 48 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('NotificationTickets', {
      recepientEmail: ['test@example.com']
    }, {});
  }
};
