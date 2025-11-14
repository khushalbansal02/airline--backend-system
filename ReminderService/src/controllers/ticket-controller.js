const tickerService = require('../services/email-service')
const create=async (req,res)=>{
  try{
  const response = await tickerService.createNotification(req.body);
  return res.status(200).json({
    success:true,
    data:response,
    error:{},
    message:"successfully created the notification entry"
  })
}catch(error){
  console.log("unable to create the notification entry")
  throw error;
  }
}
module.exports={create}