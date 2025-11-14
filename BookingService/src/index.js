const express= require('express')
const {PORT}=require('./config/server-config')
const axios= require('axios');
const bodyParser=require('body-parser')
const apiRoutes=require('./routes/index')
const db=require('./models/index');
const { FLIGHT_SERVICE_PATH } = require('./config/server-config');
const setUpAndStartServer=async ()=>{
const app= express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use('/api',apiRoutes);
  
app.listen(PORT,async ()=>{
  console.log(`Server Started at ${PORT}`)
    if(!process.env.DB_SYNC){
      db.sequelize.sync({alter:true});
    }
  
  }) 
}
setUpAndStartServer()