const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path'); // AJOUTÉ : Pour gérer les chemins de fichiers

dotenv.config();
connectDB();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// MODIFIÉ : Utilisation de path.join pour être sûr que le dossier 'uploads' est accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'One of the selected files is too large. Max allowed is 120MB per file.' });
    }
    return res.status(400).json({ message: err.message || 'File upload error' });
  }

  if (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }

  return next();
});

module.exports = app;