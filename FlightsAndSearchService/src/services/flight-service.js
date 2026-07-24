const {FlightRepository,AirplaneRepository}=require('../repository/index')
const {comparetime}=require('../utils/helper')

class FlightService{


  constructor(){
    this.airplaneRepository=new AirplaneRepository();
    this.flightRepository=new FlightRepository();
  }


  async createflight(data){

    try{
      console.log(data);
      if(!comparetime(data.arrivalTime,data.departureTime)){
        throw {error:'arrival time cannot be less than the departure time'};
      }
      const existingFlight = await this.flightRepository.findByAirplaneAndFlightNumber(data.airplaneId, data.flightNumber);
      if(existingFlight){
        throw { error: 'A flight with this number already exists for the selected airplane' };
      }
      const airplane = await this.airplaneRepository.getAirplane(data.airplaneId);
      if(!airplane){
        throw { error: 'Airplane not found' };
      }
      console.log(airplane);
      const flight=await this.flightRepository.createFlight({...data,totalSeats:airplane.capacity});
      return flight;
    }
    catch(error){
      console.log("something went wrong at the flight service layer");
      console.log(error);
      throw error;
    }

  }

  async createAirplane(data){
    try{
      const existingAirplane = await this.airplaneRepository.findByModelNumber(data.modelNumber);
      if(existingAirplane){
        throw { error: 'An airplane with this modelNumber already exists' };
      }
      const airplane=await this.airplaneRepository.createAirplane(data);
      return airplane;
    }
    catch(error){
      console.log("something went wrong at the airplane service layer");
      throw error;
    }
  }

  async updateAirplane(airplaneId,data){
    try{
      const airplane=await this.airplaneRepository.updateAirplane(airplaneId,data);
      return airplane;
    }
    catch(error){
      console.log("something went wrong at the airplane service layer");
      throw error;
    }
  }
  async getFlightData(flightId){
    try{
    const flight=await this.flightRepository.getFlight(flightId);
    return flight;
    }
    catch(error){
      console.log("something went wrong at the flight service layer");
      console.log(error);
    }
  }
  async getAllFlightData(data){
    try{
    const flight=await this.flightRepository.getAllFlights(data);
    return flight;
    }
    catch(error){
      console.log("something went wrong at the flight service layer");
      console.log(error);
    }

  }
  async updateFlight(flightId,data){
    try{
      const response= await this.flightRepository.updateFlight(flightId,data);
      console.log(flightId,data);
      console.log(response);
      return response;
    }
    catch(error){
      console.log("something went wrong at the service layer");
      throw error;
    }
  }

  // Atomically reserve seats. Returns true if reserved, false if not enough
  // seats remain. Used by the BookingService saga (JOURNAL 1.1 / 1.2).
  async reserveSeats(flightId, seats){
    try{
      return await this.flightRepository.reserveSeats(flightId, seats);
    }
    catch(error){
      console.log("something went wrong reserving seats at the service layer");
      throw error;
    }
  }

  // Compensating action: release previously reserved seats.
  async releaseSeats(flightId, seats){
    try{
      return await this.flightRepository.releaseSeats(flightId, seats);
    }
    catch(error){
      console.log("something went wrong releasing seats at the service layer");
      throw error;
    }
  }
  
  

}

module.exports=FlightService;
/**
 * {
 * flightNumber,
 * airplaneId
 * departureAirportid,
 * arrivalAirportid,
 * arrivaltime
 * departuretime
 * price
 * totalseat-> fetch from the aiplane// there fore we need the airplace repo also 
 * 
 * }
 */
