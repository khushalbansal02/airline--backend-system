const express =require('express');
const morgan = require('morgan')
const app=express();
const axios= require('axios')
const {rateLimit}= require('express-rate-limit')
const {createProxyMiddleware}= require('http-proxy-middleware')
const PORT=3006
const limiter = rateLimit({ 
	windowMs: 2 * 60 * 1000, // 15 minutes
	limit: 5, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
})

app.use(morgan("combined"));
    

app.use(limiter)
app.use('/bookingservice',async (req,res,next)=>{
  console.log(req.headers['x-access-token']);
  try{
  const response = await axios.get('http://localhost:3001/api/v1/isAuthenticated',{
    headers:{ 
      'x-access-token':req.headers['x-access-token'], 
    }
  })
  if(response.data.success==true)
    next();
  else return res.status(401).json({
    message:"unauthorized",
  
  }) 
}
catch(error){
  return res.status(500).json({
    message:"something went wrong ",
  
  })
}
  
  
})
app.use(
  '/bookingservice',
  createProxyMiddleware({
    target: 'http://localhost:3002/',
    changeOrigin: true,
  }),
);
app.get('/home',(req,res)=>{
  return res.status(200).json({
    hello:"hi", 
  }) 
})

app.listen(3006,()=>{ 
  console.log(`server started at port ${PORT}`);
})


