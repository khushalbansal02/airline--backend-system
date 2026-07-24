const express = require('express');
const CityController = require('../../controllers/city-controller');
const FlightController=require('../../controllers/flight-controller');
const AirportController=require('../../controllers/airport-controller');
const router = express.Router();
const {FlightMiddlewares}= require('../../middlewares/index')
router.post('/city', CityController.create);
router.delete('/city/:id',CityController.destroy);
router.get('/city/:id',CityController.get);
router.patch('/city/:id',CityController.update);
router.get('/city',CityController.getall);
router.patch('/flights/:id',FlightController.update)
router.post('/flights',FlightMiddlewares.validateCreateFlight,FlightController.create)
router.post('/airplanes', FlightController.createAirplane)
router.patch('/airplanes/:id', FlightController.updateAirplane)
router.get('/flights/:id',FlightController.getflight);
router.get('/flights',FlightController.getAll);
// Atomic seat inventory operations used by the BookingService saga (JOURNAL 1.1)
router.post('/flights/:id/seats/reserve',FlightController.reserveSeats);
router.post('/flights/:id/seats/release',FlightController.releaseSeats);
router.post('/airports', AirportController.create)
// router.post('/cities',CityController.creates);
module.exports = router;

