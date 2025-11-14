'use strict';
const {
  Model
} = require('sequelize');
const {SALT}=require('../config/server-config')
const bcrypt = require('bcrypt');
const role = require('./role');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.belongsToMany(models.Role,{through:'User_Roles'})
    }
  }
  User.init({
    email: {type:DataTypes.STRING,
      allowNull:false,
      unique:true,
      validate:{
        isEmail:true,
      }
    },
    password:{ type:DataTypes.STRING,
      allowNull:false,
      validate:{
        len:[3,300],
      }
    }
  }, {
    sequelize,
    modelName: 'User',
  });
  User.beforeCreate((user)=>{
    
const encriptedpassword=bcrypt.hashSync(user.password,SALT);
user.password=encriptedpassword;
  })
  return User;
};