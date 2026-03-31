require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    server.close(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully.');
    server.close(() => process.exit(0));
  });
})();
