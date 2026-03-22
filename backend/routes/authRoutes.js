const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  googleLogin,
  adminLogin,
  createSubAdmin,
  getMe,
  checkEmail,
  checkPhone,
  checkResetOptions,
  forgotPassword,
  resetPassword,
  verifyEmail,
  updatePassword,
  subAdminForgotPassword,
  resetSubAdminPassword,
  sendPhoneVerification,
  verifyPhone,
  forgotPasswordPhone,
  resetPasswordPhone,
  updateProfile,
  requestEmailChange,
  confirmEmailChange,
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
router.post('/admin/login', loginLimiter, adminLogin);
router.post('/admin/subadmins', loginLimiter, createSubAdmin);
router.post('/google', googleLogin);
router.get('/check-email', checkEmail);
router.get('/check-phone', checkPhone);
router.post('/forgot', forgotPassword);
router.post('/check-reset-options', checkResetOptions);
router.post('/reset', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/update-password', protect, updatePassword);
router.post('/sub-admin/forgot', subAdminForgotPassword);

// Phone verification & SMS reset
router.post('/phone/send-verification', protect, sendPhoneVerification);
router.post('/phone/verify', protect, verifyPhone);
router.post('/phone/forgot', forgotPasswordPhone);
router.post('/phone/reset', resetPasswordPhone);

router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/change-email', protect, requestEmailChange);
router.post('/confirm-email-change', protect, confirmEmailChange);
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
router.post('/admin/subadmins/:id/reset-password', protect, admin, require('../middleware/authMiddleware').superAdminOnly, resetSubAdminPassword);

const { getCertificationFile } = require('../controllers/authController');
// Get certification file
router.get('/admin/manufacturers/:id/certification', protect, admin, getCertificationFile);

// File upload for certification documents (manufacturer) — saved to disk
const certStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/certifications');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cert-${Date.now()}${ext}`);
  },
});
const certUpload = multer({ storage: certStorage });

// Override register to accept multipart with optional certificationFile
router.post('/register', certUpload.single('certificationFile'), registerUser);

module.exports = router;
