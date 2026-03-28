const app = require('./app');
const http = require('http');
const { initSocket } = require('./socket');
const { initSubscriptionExpirationJob } = require('./jobs/subscriptionExpirationJob');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initSubscriptionExpirationJob();
});
