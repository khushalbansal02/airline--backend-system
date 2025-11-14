const {NotificationTicket}=require('../models/index')
const {Op}= require('sequelize');
class ticketRepository
{
  async getAll(){
    try{
      const tickets= await NotificationTicket.findAll();
      return tickets;
    }
    catch(error){
      console.log(error);
      throw error;
    }
  }
  async create(data){
    try {
      const ticket = await NotificationTicket.create(data);
      return ticket;
    } catch (error) {
      console.log(error);
      throw error
    }
  }
  async get(filter){
    try {
      const tickets = await NotificationTicket.findAll({
        where:{
          status:filter.status,
          // notificationTime:{[Op.lte]:new Date() 
          
        }
      })
      return tickets;
    } catch (error) {
      throw error;
    }
  }
  async update(Id,data){
    try {
      const ticket = await NotificationTicket.findByPk(Id);
      console.log(ticket);
      
        ticket.status=data.status
         await ticket.save();
        console.log(ticket);
      return ticket;
    } catch (error) {
      throw error;
    }
  }
}
module.exports=ticketRepository;