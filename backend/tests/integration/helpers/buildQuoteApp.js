const express = require('express');

const buildQuoteApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/quotes', require('../../../routes/quoteRoutes'));
  return app;
};

module.exports = { buildQuoteApp };
