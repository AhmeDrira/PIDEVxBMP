const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Render uses a proxy

// Moteur de template du mini site artisan (rendu côté serveur)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const localOriginPatterns = [
  /^https?:\/\/localhost:\d+$/i,
  /^https?:\/\/127\.0\.0\.1:\d+$/i,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/i,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$/i,
];

const allowedOrigins = new Set([
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  ...configuredOrigins,
]);

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      localOriginPatterns.some((pattern) => pattern.test(origin))
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors(corsOptions));

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      message: 'Database unavailable. Start MongoDB and restart the backend.',
    });
    return;
  }

  next();
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    etag: true,
    maxAge: '7d',
    setHeaders(res, filePath) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

      if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    },
  })
);
// === Prometheus monitoring ===
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// Routage par sous-domaine du mini site artisan.
// DOIT rester avant les routes /api : sur `slug.bmp.tn`, c'est le mini site qui
// répond, pas l'application. Les Host non concernés appellent next() aussitôt.
app.use(require('./middleware/miniSiteMiddleware'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/quotes', require('./routes/quoteRoutes'));

const artisanRoutes = require('./routes/artisanRoutes');
app.use('/api/artisans', artisanRoutes);
const expertRoutes = require('./routes/expertRoutes');
app.use('/api/experts', expertRoutes);
const conversationRoutes = require('./routes/conversations');
app.use('/api/conversations', conversationRoutes);
const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/knowledge', require('./routes/knowledgeRoutes'));
app.use('/api/logs', require('./routes/actionLogRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/ai',      require('./routes/aiRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
// Mini site artisan (slug & sous-domaine) — ne déclare que /api/check-slug pour l'instant
app.use('/api', require('./routes/domainRoutes'));
app.use('/site', require('./routes/miniSiteRoutes'));

app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/contracts', require('./routes/contractRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));

module.exports = app;
