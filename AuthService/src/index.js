const express= require('express')
const bodyParser=require('body-parser');
const app=express();
const {PORT}= require('./config/server-config');
const apiroutes=require('./routes/index')
const db= require('./models/index')
const prepareAndStartServer=()=>{
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended:true}));
  app.use('/api',apiroutes);
app.listen(PORT,()=>{
  console.log(`server started on ${PORT}` );
  if(!process.env.DB_SYNC){

db.sequelize.sync({alert:true})
  }
})
}

prepareAndStartServer();