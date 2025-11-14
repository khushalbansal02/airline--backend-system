

class crudRepository{

  constructor(model){
    this.model=new model();
  }
  async create(data){
   try {
  
    const result=await this.model.create(data);
    return result;
    
   } catch (error) {
    console.log(error);
    throw error;
   }
  }
  async destroy(modelId){
    try {
      await this.model.destroy({
        where:{
          id:modelId,
        }
      });
      return true;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async getall(){
    try {
      const result=await this.model.findAll();
      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async get(modelId){
    try {
      const result=await this.model.findByPk(modelId);
    } catch (error) {
        console.log(error);
      throw error;
    }
  }
  async updata(modelId,data){
    try {
        const result=await this.model.update(data,{where:{
        id:modelId,
    }});
    return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }


}
module.exports=crudRepository;