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

  async findByModelNumber(modelNumber){
    try{
      const airplane = await Airplane.findOne({
        where: { modelNumber }
      });
      return airplane;
    }
    catch(error){
      console.log(error);
      throw error;
    }
  }

  async createAirplane(data){
    try{
      const airplane=await Airplane.create(data);
      return airplane;
    }
    catch(error){
      console.log(error);
      throw error;
    }
  }

  async updateAirplane(airplaneId,data){
    try{
      const airplane=await Airplane.findByPk(airplaneId);
      if(!airplane){
        throw { error: 'Airplane not found' };
      }
      await airplane.update(data);
      return airplane;
    }
    catch(error){
      console.log(error);
      throw error;
    }
  }

}

module.exports=AirplaneRepository;