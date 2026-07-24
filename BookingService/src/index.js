const express= require('express')
const {PORT}=require('./config/server-config')
const axios= require('axios');
const bodyParser=require('body-parser')
const apiRoutes=require('./routes/index')
const db=require('./models/index');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');
const correlationId = require('./middlewares/correlation-id');
const { register, metricsMiddleware } = require('./config/metrics');
const { startOutboxRelay } = require('./utils/outbox-relay');
const { startBookingSweeper } = require('./utils/booking-sweeper');
const BOOKING_HOLD_TTL_MINUTES = Number(process.env.BOOKING_HOLD_TTL_MINUTES) || 15;
const setUpAndStartServer=async ()=>{
const app= express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
// Observability: correlation id first, then structured request logging (JOURNAL 2.4)
app.use(correlationId);
app.use(pinoHttp({ logger, customProps: (req) => ({ correlationId: req.correlationId }) }));
app.use(metricsMiddleware);
// Prometheus scrape endpoint (JOURNAL 3.2)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.use('/api',apiRoutes);

// Liveness/readiness probe (JOURNAL 2.3). Returns 503 if the DB is unreachable
// so a load balancer / orchestrator can stop routing traffic to this instance.
app.get('/health', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    return res.status(200).json({ status: 'ok', service: 'booking', db: 'up' });
  } catch (e) {
    return res.status(503).json({ status: 'degraded', service: 'booking', db: 'down' });
  }
});

app.listen(PORT,async ()=>{
  console.log(`Server Started at ${PORT}`)
    // Migrations are the source of truth; auto-sync is opt-in dev-only (JOURNAL 0.5)
    if(process.env.DB_SYNC === 'true'){
      console.warn('DB_SYNC=true: altering schema from models. Do NOT use in production.');
      db.sequelize.sync({alter:true});
    }
    // Background relay that reliably publishes outbox events (JOURNAL 1.4)
    startOutboxRelay(5000);
    // Background sweeper that reclaims orphaned InProcess holds (JOURNAL 1.5)
    startBookingSweeper(BOOKING_HOLD_TTL_MINUTES, 60000);
  })
}
setUpAndStartServer()