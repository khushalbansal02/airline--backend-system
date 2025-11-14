const UserService = require('../services/user-service')
const userService= new UserService();
const create= async (req,res)=>{
try{
  const response= await userService.create({
    email:req.body.email,
    password:req.body.password,
  })  
  return res.status(200).json({
    success:true,
    data:response,
    err:{},
    message:"successfully create the new user",

  })
}
catch(error){
  console.log(error);
  return res.status(400).json({
    success:false,
    data:{},
    message:"unable to create  ",
    err:error

  })
}
}

const getbyId=async(req,res)=>{
  try{

    const response= await userService.getById(req.params.id);
    return res.status(200).json({
      data:response
    })
  }
  catch(error){
    return res.status(404).json({
      success:false,
      message:"invalid userId",
      data:{},
      err:error
    })
  }
}


const signIn= async(req,res)=>{
  try{
    const response = await userService.signIn(req.body.email,req.body.password);
   
    return res.status(200).json({
      data:response,
    });
  }
  catch(error){
    console.log(error);
    return res.status(400).json({
      success:false,
      message:"Invalid failed signIn",
      data:{},
      err:error,
    })
  }
}

const isAuthenticated=async (req,res)=>{
  try{
const token= req.headers['x-access-token'];
const response= await userService.isAuthenticated(token);

return res.status(200).json({
  success:true,
  data:response,
  message:'user is authenticated and token is valid',
  err:{}
})

  }
  catch(error){
    console.log(error);
    return res.status(400).json({
      success:false,
      message:"Invalid failed signIn",
      data:{},
      err:error,
    })
  }
}



const isAdmin=async (req,res)=>{
  try{
    const response= await userService.isAdmin(req.body.id);
    return res.status(200).json({
      data:response,
      message:"successfully identification done",
      err:{},
      success:true,
    })

  }
  catch(error){
    return res.status(400).json({
      data:{},
      message:"unsuccessfully identification done",
      err:"error occured",
      success:false,
    })
  }
}
module.exports={
  create,
  signIn,
  isAuthenticated,
  isAdmin,
  getbyId,
}