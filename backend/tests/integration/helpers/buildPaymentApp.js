const express = require('express');

const buildPaymentApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/payments', require('../../../routes/paymentRoutes'));
  return app;
};

module.exports = { buildPaymentApp };
