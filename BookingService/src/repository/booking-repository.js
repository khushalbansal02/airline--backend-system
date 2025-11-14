const {Booking}= require('../models/index');


class BookingRepository{

  async create(data){
   
    try{
        const data1= await Booking.create(data);
        return data1;
    }
    catch(error){
      console.log(error);
      console.log("something went wrong at the repolayer ");
      throw error;
    }
  }

async updateBooking(bookingId,data){
try {
  const booking= await Booking.findByPk(bookingId);
  if(booking.status)
  booking.status=data.status;
booking.save();
  return booking;
} catch (error) {
  
}
}



}
module.exports={BookingRepository}