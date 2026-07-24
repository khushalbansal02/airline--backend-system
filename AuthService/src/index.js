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
  // Schema is managed by migrations (the source of truth). Auto-sync is a
  // dev-only convenience, off by default, and must be opted into explicitly.
  // Was `sync({alert:true})` — a typo that silently did nothing (JOURNAL 0.5).
  if(process.env.DB_SYNC === 'true'){
    console.warn('DB_SYNC=true: altering schema from models. Do NOT use in production.');
    db.sequelize.sync({alter:true});
  }
})
}

prepareAndStartServer();