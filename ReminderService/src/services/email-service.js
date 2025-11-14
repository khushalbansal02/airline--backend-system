const { response } = require('express')
const sender = require('../config/email-config')
const ticketRepository= require('../repository/ticket-repository');
const repo = new ticketRepository();
const sendBasicEmail= (from, to , mailSubject,mailBody)=>{
  sender.sendMail(
    {
      from:from,
      to:to,
      subject:mailSubject,
      text:mailBody
    }
   
  )
  
}
const fetchPendingEmails=async ()=>{
    try 
    {
     
      const response= await repo.get({status:"PENDING"});
      console.log(response);
      return response;
    } 
    catch (error) 
    {
      console.log(error);
      throw error;
    }
}
const createNotification = async (data)=>{
  try {
    // console.log(data);
    const response = await repo.create(data);
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
const updateTicket= async (Id,data)=>{
  try{
    const response= await repo.update(Id,data);
    return response;
  }
  catch(error){
    console.log(error);
    throw error;
  }
}
module.exports={sendBasicEmail,fetchPendingEmails,createNotification,updateTicket}