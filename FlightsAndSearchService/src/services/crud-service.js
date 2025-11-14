// const repository=require('../repository/crud-repository')

class CrudService{

  constructor(repository){
    this.repository=repository;
  }

  async create(data){
    try{

      const result=await this.repository.create(data);
      return result;
    }
    catch(error){
      throw error;
    }
  }
  async destroy(data){
    try{

      const result=await this.repository.destroy(data);
      return result;
    }
    catch(error){
      throw result;
    }

  }

  async getAll(data){
    try{

      const result=await this.repository.getAll(data);
      return result;
    }
    catch(error){
      throw error;
    }
  }

  async get(data){
    try{

      const result=await this.repository.get(data);
      return result;
    }
    catch(error){
      throw error;
    }
  }

  async update(SerciveId,data){
    try{

      const result=await this.repository.get(SerciveId,data);
      return result;
    }
    catch(error){
      throw error;
    }
  }





}

module.exports=CrudService;