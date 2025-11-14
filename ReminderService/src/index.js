const express= require('express');
const bodyParser= require('body-parser');
const {PORT,REMINDER_BINDING_KEY}=require('./config/server-config')
const sendBasicEmail = require('./services/email-service')
const  TickerController= require('./controllers/ticket-controller') 
const emailService= require('./services/email-service')
const setUpJobs= require('./utils/job')
 const {createChannel,subscribeMessage}= require('./utils/messageQueue')
const setUpAndStartServer=async ()=>{
const app= express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}))
 const channel= await createChannel();
 subscribeMessage(channel,emailService.createNotification,REMINDER_BINDING_KEY)
app.post('/api/v1/tickets',TickerController.create);
app.listen(PORT,()=>{
  console.log(`server started at ${PORT}`);
 setUpJobs();
 
});

}

setUpAndStartServer();
