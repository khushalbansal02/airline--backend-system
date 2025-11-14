const { response } = require('express');
const {BookingService }= require('../services/index')
const {createChannel,publishMessage,subscribeMessage}=require('../utils/messageQueue')
const {REMINDER_BINDING_KEY}= require('../config/server-config')
const bookingService= new BookingService();
const create=async (req, res)=>{
  try {
    const response= await bookingService.createBooking(req.body);
    console.log(response);
    
    return res.status(200).json({
      success:true,
      data:response,
      message:"successfully booked the flight",
      error:{}
    })
  } catch (error) {
    return res.status(400).json({
      success:false,
      data:{},
      message:" unable to book the flight",
      error:error,
    })
  }
}
 const sendMessageToQueue=async (req,res)=>{
  const channel= await createChannel();
  const data={
   
      subject:'this is test mail 2',
      content:'subscibe',
      recepientEmail:'krishnakhandelwal8955@gmail.com',
      notificationTime:'2024-06-03 12:30:00'
   
  };
  publishMessage(channel,REMINDER_BINDING_KEY,JSON.stringify(data));
  return res.status(200).json({ 
     message:"successfully send the message",
  }) 
 } 
 
module.exports={ 
  create,sendMessageToQueue 
}