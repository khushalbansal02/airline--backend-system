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

async updateBooking(bookingId, data, options = {}){
  try {
    const booking = await Booking.findByPk(bookingId, options);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    if (data.status) {
      booking.status = data.status;
    }
    // Must await the save AND participate in the caller's transaction if one
    // was passed, otherwise this write escapes the transaction boundary.
    await booking.save(options);
    return booking;
  } catch (error) {
    // Re-throw instead of swallowing: the service layer decides what to do
    // (rollback the transaction). Silent catches hide real failures (JOURNAL 0.3).
    console.log("something went wrong at the booking repository layer");
    throw error;
  }
}



}
module.exports={BookingRepository}