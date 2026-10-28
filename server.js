require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { envBootstrapEnabled } = require('./src/utils/bootstrapPolicy');

const PORT = process.env.PORT || 2000;

(async () => {
  try {
    await connectDB();

    if (envBootstrapEnabled('TD_AUTO_BOOTSTRAP')) {
      try {
        const { ensureTdModuleReady } = require('./src/utils/tdBootstrap');
        await ensureTdModuleReady();
      } catch (bootstrapErr) {
        console.error('[TD bootstrap] startup seed skipped:', bootstrapErr.message);
      }
    } else {
      console.log('[TD bootstrap] disabled (set TD_AUTO_BOOTSTRAP=true to run on startup)');
    }

    if (envBootstrapEnabled('SEO_AUTO_BOOTSTRAP')) {
      try {
        const { ensureSeoReady } = require('./src/utils/seoBootstrap');
        await ensureSeoReady();
      } catch (bootstrapErr) {
        console.error('[SEO bootstrap] startup seed skipped:', bootstrapErr.message);
      }
    } else {
      console.log('[SEO bootstrap] disabled (set SEO_AUTO_BOOTSTRAP=true to run on startup)');
    }

    if (envBootstrapEnabled('STOCK_AUTO_BOOTSTRAP')) {
      try {
        const { ensureStockConfigReady } = require('./src/utils/stockBootstrap');
        await ensureStockConfigReady();
      } catch (bootstrapErr) {
        console.error('[Stock bootstrap] startup seed skipped:', bootstrapErr.message);
      }
    } else {
      console.log('[Stock bootstrap] disabled (set STOCK_AUTO_BOOTSTRAP=true to run on startup)');
    }

    if (process.env.STOCK_ALERTS_ENABLED !== 'false') {
      const { runStockAlerts, expireReservations } = require('./src/services/stockAlertService');
      const intervalMs = Number(process.env.STOCK_ALERT_INTERVAL_MS) || 3600000;
      setInterval(async () => {
        try {
          await expireReservations();
          await runStockAlerts();
        } catch (err) {
          console.error('[Stock alerts]', err.message);
        }
      }, intervalMs);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
})();
