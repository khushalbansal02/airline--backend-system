const UserRepository=require('../repository/user-repository')
const jwt=require('jsonwebtoken')
const {JWT_KEY}= require('../config/server-config')

const bcrypt= require('bcrypt')
class UserService{
  constructor(){
    this.userRepository= new UserRepository();
  }
  async create(data){
    try{
      const user = await this.userRepository.create(data);
      return user;
    }
    catch(error){
      console.log("something error occured at service layer");
      throw error;
    }
  }
   createToken(user){
    try{
      
const result =  jwt.sign(user,JWT_KEY,{expiresIn:'1h'});
return result;
    }
    catch(error){
      console.log("something went wrong at the token creation")
      throw error;
    }
  }
  verifyToken(token){
    try{
      const response= jwt.verify(token,JWT_KEY);
      return response;
    }
    catch(error){
      console.log("something went wrong at the token verification");
      throw error;
    }
  }
  async signIn(email, plainPassword){
    try{
      // step 1: fetch the user with the email
      const user=await this.userRepository.getByEmail(email);
      // step 2: compare the incomming password with the ecnrypted password
      const passwordsMatch= this.checkPassword(plainPassword,user.password);
        
      console.log(passwordsMatch);
      if(passwordsMatch==false){
        console.log("password doesn't match");
        throw {error:'Incorrect password'};
        
      }
      // step 3: if the password match then create a token and send it to the user
      else{
      const newJWT=this.createToken({email:user.email,id:user.id})
      // console.log(newJWT);
      return newJWT;}
    }
    catch(error){
      throw error;
    }
  }

  async getById(id){
    try{
    const user= this.userRepository.getById(id);
      return user;
    }
    catch(error){
      throw error;
    }

  }
  async checkPassword(userInputPlainPassword,encryptedPassword){
    try{
      return bcrypt.compareSync(userInputPlainPassword,encryptedPassword);
    }
    catch(error){
      throw error;
    }
  }
  async isAuthenticated(token){
    try{
      const isTokenVerified=this.verifyToken(token);

      if(!isTokenVerified){
        throw {error:'Invalid token'};
      }
      const user=this.userRepository.getById(isTokenVerified.id);
      if(!user){
        throw {error:'no user with corresponding token exist'};

      }
      return user.id;
    }
    catch(error){
      console.log("something went wrong with the token verification");
      throw {error:"invalid user"};
    }
  }  
  async isAdmin(userId){
    try{
      const response=await this.userRepository.isAdmin(userId);
      return response;
    }
    catch(error){
      console.log("something went wrong in the service layer");
      throw {error:"invalid "};
    }
  }

}
module.exports=UserService;