const app = require('./app');
const http = require('http');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { initSubscriptionExpirationJob } = require('./jobs/subscriptionExpirationJob');

const PORT = process.env.PORT || 5000;

(async () => {
  const connection = await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (connection) {
      initSubscriptionExpirationJob();
    } else {
      console.warn('Subscription job disabled because MongoDB is not connected.');
    }
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
