const { City } = require('../models/index');
const {Op}=require('sequelize');
class CityRepository {
    
    async createCity( data ) { // destructuring the obj which is passed
        try {
           
            // console.log(data.array);

            // console.log(data.array.length);
                if(data.length>1){
                const cities=await City.bulkCreate(data);
                return cities;

                }
                else{
             const city = await City.create(data);
             return city;
                }
        } catch (error) {
            console.log("semething went wrong in the repository layer\n");
            throw {error};
        }
    }
    async deleteCity(cityId) {
        try {
            await City.destroy({
                where: {
                    id: cityId
                }
            });
            return true;
        } catch (error) {
            console.log("semething went wrong in the repository layer\n");

            throw {error};
        }
    }
    async updateCity({cityId,data}){
            try{
                    // the below approach also works but will not return 
                    //updated object 
                    // if we are using pg then returning true can be used else not
                    

                // const city= await City.update(data,{
                //     where :{
                //         id:cityId
                //     }
                // });
                const city = await City.findByPk(cityId);
                city.name=data.name;
                await city.save();
                return city;
            } 
            catch(error){
                throw(error);
            }
    }

    async getCity(cityId){
        try{
            const city= await City.findByPk(cityId);
            return city;
        }
        catch(error){
            console.log("semething went wrong in the repository layer\n");
                throw {error};
        }
    }
    async getall(filter){
        try{
            if(filter.name){
                const cities=await City.findAll({
                    where:{
                        name:{
                            [Op.startsWith]:filter.name,
                            
                        }
                    }
                   
                });
                return cities
            }
            const city= await City.findAll();
            return city;
        }
        catch(error){
            console.log("semething went wrong in the repository layer\n");
                throw {error};
        }
    }

}

module.exports = CityRepository;