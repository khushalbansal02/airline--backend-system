const express= require('express')
const {PORT}=require('./config/server-config')
const axios= require('axios');
const bodyParser=require('body-parser')
const apiRoutes=require('./routes/index')
const db=require('./models/index');
const { startOutboxRelay } = require('./utils/outbox-relay');
const setUpAndStartServer=async ()=>{
const app= express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use('/api',apiRoutes);

app.listen(PORT,async ()=>{
  console.log(`Server Started at ${PORT}`)
    // Migrations are the source of truth; auto-sync is opt-in dev-only (JOURNAL 0.5)
    if(process.env.DB_SYNC === 'true'){
      console.warn('DB_SYNC=true: altering schema from models. Do NOT use in production.');
      db.sequelize.sync({alter:true});
    }
    // Background relay that reliably publishes outbox events (JOURNAL 1.4)
    startOutboxRelay(5000);
  })
}
setUpAndStartServer()