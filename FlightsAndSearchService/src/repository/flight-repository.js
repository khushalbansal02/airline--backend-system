const {Flights}=require('../models/index');
const {Op}=require('sequelize');
class FlightRepository{

  #createFilter(data){
    let filter={};
      if(data.departureAirportId){
        filter.departureAirportId=data.departureAirportId
      }
      if(data.arrivalAirportId){
        filter.arrivalAirportId=data.arrivalAirportId
      }
      // if(data.maxprice && data.minprice){
      //   Object.assign(filter,{price:{[Op.between]:[data.minprice,data.maxprice]}})
      // }
      // else if(data.minprice){
      //   Object.assign(filter,{price:{[Op.gte]:data.minprice}})
      // }
      // else if(data.maxprice){
      //   Object.assign(filter,{price:{[Op.lte]:data.minprice}})
      // }
      let pricefilter=[];
      if(data.minprice){
        pricefilter.push({price:{[Op.gte]:data.minprice}});
      }
      if(data.maxprice){
        pricefilter.push({price:{[Op.lte]:data.maxprice}});
      }
      Object.assign(filter,{[Op.and]:pricefilter});
      // console.log(filter);
        return filter;

  }
  async createFlight( data ) { // destructuring the obj which is passed
    try {
         const flight = await Flights.create(data);
         return flight;
        }
     catch (error) {
        console.log("semething went wrong in the repository layer\n");
        throw {error};
    }
}

  async findByAirplaneAndFlightNumber(airplaneId, flightNumber){
    try{
      const flight = await Flights.findOne({
        where: {
          airplaneId,
          flightNumber,
        }
      });
      return flight;
    }
    catch(error){
      console.log(error);
      throw error;
    }
  }

  async getFlight(flightId){
    try{
      const flight=await Flights.findByPk(flightId);
      return flight;
    }
    catch(error){
      console.log(error);
    }
  }

  async getAllFlights(filter){
    try{
      const filterObject=this.#createFilter(filter);
      


      const flight=await Flights.findAll({
        where:filterObject
      });
      return flight;
      /**
       * so this will create the filte object that will have the body
       * structure as 
       * {
       *  departureAirportId:
       *  arrivalAirportId:
       *  price: {[Op.gte]>minprice}
       *    
       * }
       */
      
    }catch(error){
      console.log(error);
    }

  }

  async updateFlight(flightId,data){
    try {
      // Must await: without it we report success before the DB confirms the
      // write, and any failure becomes an unhandled rejection (JOURNAL 0.2).
      // Return the affected-row count so callers can detect "updated 0 rows".
      const [affectedRows] = await Flights.update(data, {
        where: { id: flightId },
      });
      return affectedRows;
    } catch (error) {
      console.log("something went wrong at the flight repository layer");
      throw error;
    }
  }

  // ── Concurrency-safe seat inventory (JOURNAL 1.1) ────────────────────────
  // The overselling bug came from read-modify-write across two services:
  //   read totalSeats -> subtract in app code -> write back.
  // Two concurrent bookings both read the same value and both write, losing
  // one update. The fix is a SINGLE atomic SQL statement whose WHERE clause
  // guards the invariant, so the DATABASE serializes concurrent writers and
  // the "not enough seats" check and the decrement happen indivisibly.
  async reserveSeats(flightId, seats){
    try {
      const n = Number(seats);
      if (!Number.isInteger(n) || n <= 0) {
        throw { error: 'seats must be a positive integer' };
      }
      // UPDATE Flights SET totalSeats = totalSeats - n
      //   WHERE id = flightId AND totalSeats >= n
      // affectedRows === 1 -> we won and reserved; 0 -> not enough seats
      // (or a concurrent booking took them). No row can ever go negative.
      const [affectedRows] = await Flights.update(
        { totalSeats: Flights.sequelize.literal(`totalSeats - ${n}`) },
        { where: { id: flightId, totalSeats: { [Op.gte]: n } } }
      );
      return affectedRows === 1;
    } catch (error) {
      console.log("something went wrong reserving seats at the repository layer");
      throw error;
    }
  }

  // Compensating action for the Saga: give the seats back atomically.
  async releaseSeats(flightId, seats){
    try {
      const n = Number(seats);
      if (!Number.isInteger(n) || n <= 0) {
        throw { error: 'seats must be a positive integer' };
      }
      const [affectedRows] = await Flights.update(
        { totalSeats: Flights.sequelize.literal(`totalSeats + ${n}`) },
        { where: { id: flightId } }
      );
      return affectedRows === 1;
    } catch (error) {
      console.log("something went wrong releasing seats at the repository layer");
      throw error;
    }
  }




}


module.exports=FlightRepository; 