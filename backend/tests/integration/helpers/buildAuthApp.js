/**
 * Builds a lightweight Express app mounting only the auth router so integration
 * tests boot fast and don't pull in heavy unrelated dependencies (sockets, AI
 * services, etc.). Callers should `jest.mock(...)` external services BEFORE
 * importing this module.
 */
const express = require('express');

const buildAuthApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/auth', require('../../../routes/authRoutes'));
  return app;
};

module.exports = { buildAuthApp };
