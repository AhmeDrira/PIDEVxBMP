const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));
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


module.exports = app;
