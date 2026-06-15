require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 2000;

(async () => {
  try {
    await connectDB();

    if (process.env.TD_AUTO_BOOTSTRAP !== 'false') {
      try {
        const { ensureTdModuleReady } = require('./src/utils/tdBootstrap');
        await ensureTdModuleReady();
      } catch (bootstrapErr) {
        console.error('[TD bootstrap] startup seed skipped:', bootstrapErr.message);
      }
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
})();
