const express = require("express");
const bodyParser = require("body-parser");

const { PORT } = require('./config/serverConfig');
const db=require('./models/index')
const {City,Airport,Airplane}=require('./models/index')
const apiroutes=require('./routes/index')

const cleanupDuplicateAirplanes = async () => {
  try {
    const duplicates = await db.sequelize.query(
      `SELECT modelNumber, COUNT(*) as count FROM Airplanes GROUP BY modelNumber HAVING COUNT(*) > 1`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    for (const row of duplicates) {
      const airplanes = await Airplane.findAll({
        where: { modelNumber: row.modelNumber },
        order: [['id', 'ASC']],
      });
      const [keep, ...remove] = airplanes;
      for (const airplane of remove) {
        await airplane.destroy();
        console.log(`Removed duplicate airplane record with modelNumber=${row.modelNumber} id=${airplane.id}`);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup duplicate airplanes before sync:', error);
    throw error;
  }
};

const setupAndStartServer = async () => {
    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use('/api',apiroutes);

    try {
      // Standardized on DB_SYNC across all services; opt-in, dev-only (JOURNAL 0.5)
      if(process.env.DB_SYNC === 'true'){
        console.warn('DB_SYNC=true: altering schema from models. Do NOT use in production.');
        await cleanupDuplicateAirplanes();
        await db.sequelize.sync({alter:true});
      }
      app.listen(PORT, () => {
          console.log(`Server started at ${PORT}`);
      });
    } catch (error) {
      console.error('Server startup failed:', error);
      process.exit(1);
    }
}

setupAndStartServer();
