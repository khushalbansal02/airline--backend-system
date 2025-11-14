const ClientErrorsCodes = Object.freeze({
  BAD_REQUEST:400,
  UNAUTHORIZED:401,
  NOT_FOUND:404
});

const ServerErrorsCodes=Object.freeze({
  INTERNAL_SERVER_ERROR:500,
  NOT_IMPLEMENTED:501,

});
const SuccessCodes=Object.freeze({
  CREATED:201,
  OK:200
});
// here Object.freeze makes the object in immutable that is 
// it can't be changed or added with the new key


module.exports={
  ClientErrorsCodes,
  SuccessCodes,
  ServerErrorsCodes,
}