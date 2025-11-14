const {FlightService}=require('../services/index')
const flightservice=new FlightService();

const create= async (req,res)=>{

  try{
      const flight=await flightservice.createflight(req.body);
      return res.status(200).json({
        data:flight,
        success:true, 
        err:{},
        message:"successfully created flight",
      })

  }
  catch (error) {
    console.log(error);
    return res.status(500).json({
        data: {},
        success: false, 
        message: 'Not able to create a flight',
        err: error
    });
}
}
const getflight=async(req,res)=>{
  try{ 
    const id=req.params.id;
    const response= await flightservice.getFlightData(id);
    return res.status(200).json({
      data:response,
      success:true,
      message:"successfully fetched the flight",
      err:{}
    })
  }
  catch(error){
    return res.status(404).json({
      message:`not able to fetch the ${flight}`,
    })
  }
}
const getAll= async (req,res)=>{
  try{
   
    const response=await flightservice.getAllFlightData(req.query);
  
    return res.status(500).json({
      data:response,
      success:true,
        err:{},
        message:"successfully fetched flight",

    })
  }catch(error){
    return res.status(404).json({
      message:"tumse na ho payi",
    })
  }


}
const update=async (req,res)=>{
  try{
   
    const response=await flightservice.updateFlight(req.params.id,req.body);
    // console.log(req.body);
    return res.status(200).json({
      data:response,
      success:true,
        err:{},
        message:"successfully updated the flight",

    })
  }catch(error){
    return res.status(404).json({
      message:"tumse na ho payi flight update",
    })
  }
}

module.exports={
  create,
  getAll,
  getflight,
  update
}