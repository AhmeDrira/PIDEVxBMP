/**
 * Lightweight Express app exposing only /api/products for integration tests.
 * Callers must mock external services (stripe, multer optional) before requiring this file.
 */
const express = require('express');

const buildProductApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/products', require('../../../routes/productRoutes'));
  return app;
};

module.exports = { buildProductApp };
