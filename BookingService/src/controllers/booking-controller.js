const { response } = require('express');
const {BookingService }= require('../services/index')
const {createChannel,publishMessage,subscribeMessage}=require('../utils/messageQueue')
const {REMINDER_BINDING_KEY}= require('../config/server-config')
const bookingService= new BookingService();
const create=async (req, res)=>{
  try {
    // Standard header for idempotent APIs (Stripe, etc.). Falls back to a body
    // field so it's easy to test from any client (JOURNAL 1.3).
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const response= await bookingService.createBooking({ ...req.body, idempotencyKey, correlationId: req.correlationId });
    return res.status(201).json({
      success:true,
      data:response,
      message:"Successfully booked the flight",
      err:{}
    })
  } catch (error) {
    // Map the AppError's statusCode (409 for no seats, 404, 400, 502…) instead
    // of returning 400 for everything (JOURNAL 0.4 / 1.2).
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success:false,
      data:{},
      message: error.message || "Unable to book the flight",
      err: error.message || error,
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