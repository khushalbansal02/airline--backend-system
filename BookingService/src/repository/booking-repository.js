const {Booking}= require('../models/index');
const {Op}= require('sequelize');


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

  // Look up an existing booking by its idempotency key (JOURNAL 1.3).
  async findByIdempotencyKey(idempotencyKey){
    try{
      return await Booking.findOne({ where: { idempotencyKey } });
    }
    catch(error){
      console.log("something went wrong looking up idempotency key");
      throw error;
    }
  }

async updateBooking(bookingId, data, options = {}){
  try {
    const booking = await Booking.findByPk(bookingId, options);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    if (data.status !== undefined) {
      booking.status = data.status;
    }
    if (data.seatsReserved !== undefined) {
      booking.seatsReserved = data.seatsReserved;
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

// Find orphaned holds: bookings still InProcess past the hold TTL (JOURNAL 1.5).
async findExpiredHolds(cutoff){
  try {
    return await Booking.findAll({
      where: {
        status: 'InProcess',
        createdAt: { [Op.lt]: cutoff },
      },
    });
  } catch (error) {
    console.log("something went wrong finding expired holds");
    throw error;
  }
}



}
module.exports={BookingRepository}