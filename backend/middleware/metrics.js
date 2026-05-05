const promClient = require('prom-client');

// Registre de métriques (par défaut)
const register = new promClient.Registry();

// Métriques par défaut Node.js : RAM, CPU, event loop, GC, etc.
promClient.collectDefaultMetrics({
  register,
  prefix: 'pidev_backend_',
});

// Compteur de requêtes HTTP
const httpRequestsTotal = new promClient.Counter({
  name: 'pidev_backend_http_requests_total',
  help: 'Total des requêtes HTTP reçues',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Histogramme de latence
const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'pidev_backend_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Jauge des requêtes en cours
const httpRequestsInFlight = new promClient.Gauge({
  name: 'pidev_backend_http_requests_in_flight',
  help: 'Nombre de requêtes HTTP en cours de traitement',
  registers: [register],
});

// Middleware Express : mesure chaque requête
function metricsMiddleware(req, res, next) {
  // Skip /metrics lui-même pour ne pas s'auto-compter
  if (req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  httpRequestsInFlight.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    // route = req.route?.path si dispo, sinon path brut (limité pour cardinalité)
    const route = req.route?.path || req.baseUrl || req.path || 'unknown';
    const labels = {
      method: req.method,
      route: route.substring(0, 80), // protection cardinalité
      status_code: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, duration);
    httpRequestsInFlight.dec();
  });

  next();
}

// Handler pour exposer /metrics
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  register,
};
