'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Booking.init({
    flightId: {
      type:DataTypes.INTEGER,
      allowNull:false,
    },
    userId: {
      type:DataTypes.INTEGER,
      allowNull:false,
    },
    status: {
      type:DataTypes.ENUM,
      allowNull:false,
      values:['InProcess','Booked','Cancelled'],
      defaultValue:'InProcess'
    },
    noofSeats:{
      type:DataTypes.INTEGER,
      allowNull:false,
      defaultValue:1,
    },
    totalCost:{
      type:DataTypes.INTEGER,
      allowNull:false,
      defaultValue:0,
    },
    // Client-supplied key that makes booking creation idempotent (JOURNAL 1.3).
    // UNIQUE => at most one booking can ever exist per key, even under a race.
    idempotencyKey:{
      type:DataTypes.STRING,
      allowNull:true,
      unique:true,
    },
    // True once seats are reserved remotely; lets the sweeper know whether an
    // expired InProcess hold needs its seats released (JOURNAL 1.5).
    seatsReserved:{
      type:DataTypes.BOOLEAN,
      allowNull:false,
      defaultValue:false,
    },
  }, {
    sequelize,
    modelName: 'Booking',
  });
  return Booking;
};