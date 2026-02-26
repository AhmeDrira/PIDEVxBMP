const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  createAdmin,
  getMe,
  checkEmail,
  checkPhone,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, loginUser);
router.get('/check-email', checkEmail);
router.get('/check-phone', checkPhone);
router.post('/forgot', forgotPassword);
router.post('/reset', resetPassword);
router.post('/admin/create', createAdmin);
router.get('/me', protect, getMe);
// Admin manufacturer verification
router.get('/admin/manufacturers/pending', protect, admin, require('../controllers/authController').getPendingManufacturers);
router.post('/admin/manufacturers/:id/approve', protect, admin, require('../controllers/authController').approveManufacturer);
router.post('/admin/manufacturers/:id/decline', protect, admin, require('../controllers/authController').rejectManufacturer);

// Admin user management
router.get('/admin/users', protect, admin, require('../controllers/authController').listUsers);
router.post('/admin/users/:id/suspend', protect, admin, require('../controllers/authController').suspendUser);
router.post('/admin/users/:id/activate', protect, admin, require('../controllers/authController').activateUser);
router.delete('/admin/users/:id', protect, admin, require('../controllers/authController').deleteUser);

const { getCertificationFile } = require('../controllers/authController');
// Get certification file
router.get('/admin/manufacturers/:id/certification', protect, admin, getCertificationFile);

// File upload for certification documents (manufacturer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Override register to accept multipart with optional certificationFile
router.post('/register', upload.single('certificationFile'), registerUser);

module.exports = router;
