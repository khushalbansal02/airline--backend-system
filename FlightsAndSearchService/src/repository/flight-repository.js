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
      Flights.update(data,{where:{
        id:flightId,
      }});
      return true;
    } catch (error) {
      
      console.log("something went wrong at the repolayer");
      throw error;

    }
  }




}


module.exports=FlightRepository; 