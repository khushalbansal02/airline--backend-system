const express=require('express')
const router=express.Router();
const {BookingController}= require('../../controllers/index')
const { validateBody, createBookingSchema } = require('../../middlewares/validate')

router.post('/bookings', validateBody(createBookingSchema), BookingController.create);
module.exports=router;