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

const createAirplane= async (req,res)=>{
  try{
    const airplane=await flightservice.createAirplane(req.body);
    return res.status(200).json({
      data:airplane,
      success:true,
      err:{},
      message:"successfully created airplane",
    })
  }
  catch(error){
    console.log(error);
    return res.status(500).json({
      data:{},
      success:false,
      message:'Not able to create an airplane',
      err:error
    });
  }
}

const updateAirplane= async (req,res)=>{
  try{
    const airplane=await flightservice.updateAirplane(req.params.id, req.body);
    return res.status(200).json({
      data:airplane,
      success:true,
      err:{},
      message:"successfully updated airplane",
    })
  }
  catch(error){
    console.log(error);
    return res.status(500).json({
      data:{},
      success:false,
      message:'Not able to update airplane',
      err:error
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
      success:false,
      message:`Unable to fetch flight with id ${req.params.id}`,
      data:{},
      err:error,
    })
  }
}
const getAll= async (req,res)=>{
  try{
    const response=await flightservice.getAllFlightData(req.query);
    return res.status(200).json({ // was 500 on the success path (JOURNAL 0.4)
      data:response,
      success:true,
      err:{},
      message:"successfully fetched flights",
    })
  }catch(error){
    return res.status(500).json({
      success:false,
      message:"Unable to fetch flights",
      data:{},
      err:error,
    })
  }
}
const update=async (req,res)=>{
  try{
    const response=await flightservice.updateFlight(req.params.id,req.body);
    return res.status(200).json({
      data:response,
      success:true,
      err:{},
      message:"successfully updated the flight",
    })
  }catch(error){
    return res.status(500).json({
      success:false,
      message:"Unable to update the flight",
      data:{},
      err:error,
    })
  }
}

// Atomic seat reservation endpoint. 409 (Conflict) when seats are unavailable
// — the correct HTTP semantics for "your request conflicts with current state"
// (JOURNAL 0.4 / 1.1). The BookingService saga calls this.
const reserveSeats = async (req,res)=>{
  try{
    const reserved = await flightservice.reserveSeats(req.params.id, req.body.seats);
    if(!reserved){
      return res.status(409).json({
        success:false,
        message:"Insufficient seats available",
        data:{},
        err:{},
      });
    }
    return res.status(200).json({
      success:true,
      message:"Seats reserved successfully",
      data:{ flightId: req.params.id, seats: req.body.seats },
      err:{},
    });
  }catch(error){
    return res.status(500).json({
      success:false,
      message:"Unable to reserve seats",
      data:{},
      err:error,
    });
  }
}

const releaseSeats = async (req,res)=>{
  try{
    const released = await flightservice.releaseSeats(req.params.id, req.body.seats);
    return res.status(200).json({
      success:released,
      message: released ? "Seats released successfully" : "Flight not found",
      data:{ flightId: req.params.id, seats: req.body.seats },
      err:{},
    });
  }catch(error){
    return res.status(500).json({
      success:false,
      message:"Unable to release seats",
      data:{},
      err:error,
    });
  }
}

module.exports={
  create,
  createAirplane,
  updateAirplane,
  getAll,
  getflight,
  update,
  reserveSeats,
  releaseSeats,
}