const CrudRepository=require('./crud-repository');
const {Airport}=require('../models/index')
class AirportRepository extends CrudRepository{

  constructor(){
    super(Airport);
  }
    

  async create(data){
    try {
     
     const result=await Airport.create(data);
     return result;
   
    } catch (error) {
     console.log(error);
     throw error;
    }
   }



}
module.exports=AirportRepository