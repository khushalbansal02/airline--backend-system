const { where } = require('sequelize');
const {User,Role}= require('../models/index');
const user = require('../models/user');

class UserRepository{
  async create(data){

    try{
      console.log(data);
      const user= await User.create(data);
      return user;
    }
    catch(error){
      console.log(error);
      console.log("something went wrong at the repository layer");
      throw error;
    }

  }
  async destroy(userId){
    try{
       await User.destroy({
        where:{
          id:userId,
        }
       });
       return true;
    }
    catch(error){
      console.log("something went wrong at the repository layer");
      throw error;
    }
  }
  async getById(userId){
    try{
    const user = await User.findByPk(userId,{
      attributes:['email','id']
    })
    return user;
    }
    catch(error){
      throw error;
    }
  }
  async getByEmail( userEmail){
    try{
    const user= await User.findOne({where :{
        email:userEmail
      }
    });
    // console.log(user);
    return user;
  }
  catch(error){
    throw error;
  }

  }
  async isAdmin(userId){
    try{
      const user = await User.findByPk(userId);
      const adminRole= await Role.findOne({
        where:{
          name:'Admin'
        }
      })
      return user.hasRole(adminRole);
    }
    catch(error){
      console.log("something went wrong at the repository layer");
      throw error;
    }
  }
}
module.exports=UserRepository