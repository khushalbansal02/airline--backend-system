const {Airplane}=require('../models/index');

class AirplaneRepository{

  async getAirplane(id){
   
    try
    {
      console.log(id);
      const airplane=await Airplane.findByPk(id)
     
      console.log(airplane);
      return airplane;
    }
    catch(error){
      console.log(error);
    }
  }



}

module.exports=AirplaneRepository;