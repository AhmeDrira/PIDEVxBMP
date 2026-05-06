const express = require('express');

const buildInvoiceApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/invoices', require('../../../routes/invoiceRoutes'));
  return app;
};

module.exports = { buildInvoiceApp };
