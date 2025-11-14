const express = require("express");
const bodyParser = require("body-parser");

const { PORT } = require('./config/serverConfig');
const db=require('./models/index')
const {City,Airport}=require('./models/index')
const apiroutes=require('./routes/index')
const setupAndStartServer = async () => {
    // create the express object
    
    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    
    app.use('/api',apiroutes);
    app.listen(PORT, async () => {
        console.log(`Server started at ${PORT}`);
        if(process.env.SYNC_DB==1){
            db.sequelize.sync({alter:true}); 
        }
        // db.sequelize.sync({alter:true}); // this will sycn all the models at once
        // const newair=await City.findOne({
        //     where:{
        //         id:7
        //     }
        // })
        // const airp= await newair.getAirports();
        // console.log(airp);
    });
}

setupAndStartServer();
