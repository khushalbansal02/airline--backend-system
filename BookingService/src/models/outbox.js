'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Outbox extends Model {
    static associate(models) {
      // no associations
    }
  }
  Outbox.init(
    {
      eventType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'PUBLISHED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Outbox',
      updatedAt: false, // rows are write-once then marked published
    }
  );
  return Outbox;
};
