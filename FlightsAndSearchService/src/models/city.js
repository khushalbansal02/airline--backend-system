'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class City extends Model {
   
    static associate(models) {
     // here we mention all the associations
     this.hasMany(models.Airport,{
      foreignKey:'cityId' 
     });
    }
  }
  City.init({
    name: {
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true
    },
  }, {
    sequelize,
    modelName: 'City',
  });
  return City;
};