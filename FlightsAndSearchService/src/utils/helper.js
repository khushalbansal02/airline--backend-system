function comparetime(timeString1,timeString2){
  let datetime1= new Date(timeString1);
  let datetime2= new Date(timeString2);
  console.log(datetime1.getTime());
  return datetime1.getTime()>datetime2.getTime();
}
module.exports={comparetime};