const {validateAuthUser,validateIsAdmin}=require('./auth-request-validator')

module.exports={
  validator:validateAuthUser,
  adminValidator:validateIsAdmin
}