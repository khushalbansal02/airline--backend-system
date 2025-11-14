const {ClientErrorsCodes}= require('../utils/error-codes')

const validateCreateFlight= (req,res,next)=>{
  console.log(req.body);
  console.log(req.body.flightNumber,req.body.airplaneId,req.body.price);
  if(!req.body.flightNumber||
      !req.body.airplaneId||
      !req.body.price
  ){
    // if any of the body params is missing then 
    return res.status(400).json({
      data:{},
      success:false,
      message:`invalid request body for create flight`,
      err:'missing info'
    })
  } 
  next();
}

module.exports={validateCreateFlight};