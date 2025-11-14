const express= require('express');
const UserController= require('../../controllers/user-controller')
const {validator,adminValidator}=require('../../middlewares/index')
const router=express.Router();
router.post('/signup',validator,UserController.create);
router.post('/signin',validator,UserController.signIn);
router.get('/isAuthenticated',UserController.isAuthenticated)
router.get('isAdmin',adminValidator,UserController.isAdmin);
router.get('/user/:id',UserController.getbyId);
module.exports=router;