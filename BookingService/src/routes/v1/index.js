const express=require('express')
const router=express.Router();
const {BookingController}= require('../../controllers/index')

router.post('/bookings',BookingController.create);
router.post('/publish',BookingController.sendMessageToQueue);
router.get('/hi',(req,res)=>{
  return res.status(200).json({
  "hi":"bro"}
  )
});
module.exports=router;