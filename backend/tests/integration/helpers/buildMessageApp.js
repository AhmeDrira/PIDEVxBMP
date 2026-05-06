const express = require('express');

const buildMessageApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/messages', require('../../../routes/messages'));
  return app;
};

module.exports = { buildMessageApp };
