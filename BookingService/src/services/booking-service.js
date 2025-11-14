// const { BookingRepository } = require('../repository/index');
// const axios = require('axios');
// const { FLIGHT_SERVICE_PATH } = require('../config/server-config');

// class BookingService {
//   constructor() {
//     this.bookingRepository = new BookingRepository();
//   }

//   createBooking = async (data) => {
    
//       const flightId = data.flightId;
//       const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${flightId}`;
//       const response = await axios.get(getFlightRequestURL);
//       const flightData = response.data.data;
//       let priceOfTheFlight = flightData.price;
//       if(data.noofSeats > flightData.totalSeats) {
//           throw {error:"insuff"};
//       }
//       const totalCost = priceOfTheFlight * data.noofSeats;
//       const bookingPayload = {...data, totalCost};
//       const booking = await this.bookingRepository.create(bookingPayload);
//       const updateFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
//       try{
//       await axios.patch(updateFlightRequestURL, {totalSeats: flightData.totalSeats - booking.noofSeats});
//       }
//       catch(error){
//         
//     }
      
       

    
//   }
// }

// module.exports = BookingService;
const { BookingRepository } = require('../repository/index');
const axios = require('axios');
const { FLIGHT_SERVICE_PATH } = require('../config/server-config');
const { sequelize } = require('../models'); // Import Sequelize instance
const {createChannel,publishMessage,subscribeMessage}=require('../utils/messageQueue')
const {REMINDER_BINDING_KEY}= require('../config/server-config')
const moment = require('moment');
class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
  }

  createBooking = async (data) => {
    const transaction = await sequelize.transaction(); // Start transaction
    try {
      const flightId = data.flightId;
      const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${flightId}`;
      const response = await axios.get(getFlightRequestURL);
      const flightData = response.data.data;
      
      if (data.noofSeats > flightData.totalSeats) {
        throw { error: "insufficient seats" };
      }

      const totalCost = flightData.price * data.noofSeats;
      const bookingPayload = { ...data, totalCost };

      // Create booking within transaction
      const booking = await this.bookingRepository.create(bookingPayload, { transaction });

      const updateFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
      
      // Update seat count within transaction
      await axios.patch(updateFlightRequestURL, { 
        totalSeats: flightData.totalSeats - data.noofSeats
      });
      const finalBooking = await this.bookingRepository.updateBooking(booking.id, {status: "Booked"});
       
//        
      // Commit transaction (Finalizes changes)
      await transaction.commit();

      // then push the message to the queue
      const userId=data.userId;
      const userDataRequestUrl=`http://localhost:3001/api/v1/user/${userId}`;
      const userData=await axios.get(userDataRequestUrl);
      // console.log(userData);
      const userEmail=userData.data.data.email;
      // console.log(userEmail);
      const futureDateTime = moment().add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
      const channel= await createChannel();
      console.log(userEmail);
      const data1={
   
        subject:'this is email to verify that your ticket is booked',
        content:'subscibe',
        recepientEmail:`${userEmail}`,
        notificationTime:`${futureDateTime}`
     
    };
    publishMessage(channel,REMINDER_BINDING_KEY,JSON.stringify(data1));
      



      return  finalBooking;

    } catch (error) {
      //  Rollback transaction in case of failure
      // console.log("i am the error--> ",error.data);
       await transaction.rollback();
      throw error;
    }
  };
}
 
module.exports = BookingService;
