
const validateAuthUser=(req,res,next)=>{
  if(!req.body.email || !req.body.password){
    return res.status(400).json({
      message:"something went wrong",
      err:"invalid request made",
      data:{},
      success:false,
    })

  }
  next();
}
const validateIsAdmin=(req,res,next)=>{
  if(!req.body.id){
    return res.status(400).json({
      message:"something went wrong",
      err:"invalid request made",
      data:{},
      success:false,
    })
  }
  next()
}
module.exports={validateAuthUser,validateIsAdmin};