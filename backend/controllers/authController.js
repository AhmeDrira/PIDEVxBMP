const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dns = require('dns');
const https = require('https');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { User, Artisan, Expert, Manufacturer } = require('../models/User');

// Force IPv4 for all DNS lookups and outbound HTTP(S) connections.
// Node.js 20+ / 22 uses "happy eyeballs" which tries IPv4 + IPv6 in parallel;
// if IPv6 is unavailable the aggregate ECONNREFUSED is thrown even though IPv4
// would have worked.  Pinning to family:4 prevents that.
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
// Single reusable HTTPS agent that connects only over IPv4
const ipv4Agent = new https.Agent({ family: 4 });

// Google OAuth client (for verifying ID tokens from frontend)
const googleClientId = process.env.GOOGLE_CLIENT_ID ? String(process.env.GOOGLE_CLIENT_ID).trim() : '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// Generate JWT
const generateToken = (payload) => {
  const jwtPayload =
    typeof payload === 'object' &&
    payload !== null &&
    Object.prototype.hasOwnProperty.call(payload, 'role')
      ? payload
      : { id: payload };
  return jwt.sign(jwtPayload, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const isValidAdminSecret = (input) => {
  const configuredSecret = process.env.ADMIN_SECRET_KEY;
  if (!configuredSecret || typeof input !== 'string') {
    return false;
  }
  const incoming = Buffer.from(input, 'utf8');
  const expected = Buffer.from(configuredSecret, 'utf8');
  if (incoming.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(incoming, expected);
};

// Normalize phone for duplicate check (digits only, optional leading +)
const normalizePhoneForLookup = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
};

const findUserByPhone = async (phone) => {
  const normalized = normalizePhoneForLookup(phone);
  if (!normalized) return null;
  return User.findOne({
    $or: [
      { phone: normalized },
      { phone: `+${normalized}` }
    ]
  });
};

const findUserByEmail = async (email) => {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { 
    firstName, 
    lastName, 
    email, 
    password, 
    role,
  } = req.body;

  try {
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Check if user exists
    const userByEmail = await findUserByEmail(email);
    if (userByEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    let user;

    const userData = {
      firstName,
      lastName,
      email,
      phone: '', // empty by default; user fills in profile and verifies via SMS
      password,
      role,
      isVerified: false,
      verificationToken: verificationTokenHash,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    switch (role) {
      case 'artisan':
        user = await Artisan.create({ ...userData, location: '', domain: '' });
        break;
      
      case 'expert':
        user = await Expert.create({ ...userData, domain: '' });
        break;
      
      case 'manufacturer':
        user = await Manufacturer.create({ ...userData, companyName: '' });
        break;

      case 'user':
        user = await User.create(userData);
        break;

      case 'admin':
        return res.status(403).json({ message: 'Admin registration is restricted' });

      default:
        return res.status(400).json({ message: 'Invalid role' });
    }

    if (user) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(email, verificationUrl);

      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      // Check if email is verified
      if (!user.isVerified) {
        return res.status(403).json({ 
          message: 'Please verify your email address before logging in.',
          notVerified: true 
        });
      }

      // Check manufacturer verification status
      if (user.role === 'manufacturer' && user.verificationStatus === 'pending') {
        return res.status(403).json({ 
          message: 'Your account is awaiting verification. You will have access once an admin approves your request.',
          isPendingManufacturer: true 
        });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
      }

      res.json({
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login or register via Google OAuth (ID token from frontend)
// @route   POST /api/auth/google
// @access  Public
// Helper to create a new OAuth user with the correct Mongoose discriminator model
async function createOAuthUser(baseData, role) {
  const validRoles = ['artisan', 'expert', 'manufacturer'];
  const newRole = (role && validRoles.includes(role)) ? role : 'artisan';
  switch (newRole) {
    case 'artisan':
      return Artisan.create({ ...baseData, location: '', domain: '' });
    case 'expert':
      return Expert.create({ ...baseData, domain: '' });
    case 'manufacturer':
      return Manufacturer.create({ ...baseData, companyName: '' });
    default:
      return Artisan.create({ ...baseData, location: '', domain: '' });
  }
}

async function googleLogin(req, res) {
  try {
    const { credential, role: requestedRole } = req.body || {};

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Verify the access token by calling Google's userinfo endpoint
    let googleUser;
    try {
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` },
        httpsAgent: ipv4Agent,
      });
      googleUser = userInfoRes.data;
      console.log('Google userinfo fetched for:', googleUser.email);
    } catch (err) {
      console.error('Google userinfo fetch failed:', err.response?.data || err.message);
      return res.status(401).json({ message: 'Invalid Google access token', error: err.message });
    }

    const email = googleUser.email;
    if (!email) {
      return res.status(400).json({ message: 'Google account did not return an email address' });
    }

    // Try to find an existing user by email (case-insensitive)
    let user = await findUserByEmail(email);

    if (!user) {
      const givenName = googleUser.given_name || '';
      const familyName = googleUser.family_name || '';
      const fullName = googleUser.name || '';

      let firstName = givenName;
      let lastName = familyName;

      if (!firstName && fullName) {
        const parts = fullName.split(' ');
        firstName = parts[0] || 'Google';
        lastName = parts.slice(1).join(' ') || 'User';
      }

      if (!firstName) firstName = 'Google';
      if (!lastName) lastName = 'User';

      // Generate a strong random password so the schema requirements are satisfied.
      // User can always set a real password later via "reset password".
      const randomPassword = crypto.randomBytes(32).toString('hex');

      user = await createOAuthUser({
        firstName,
        lastName,
        email,
        password: randomPassword,
        isVerified: true,
        profilePhoto: googleUser.picture || '',
      }, requestedRole);
    }

    // Apply the same business rules as normal login
    if (user.role === 'manufacturer' && user.verificationStatus === 'pending') {
      return res.status(403).json({
        message:
          'Your account is awaiting verification. You will have access once an admin approves your request.',
        isPendingManufacturer: true,
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    return res.json({
      _id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ message: 'Failed to sign in with Google' });
  }
}

// @desc    Authenticate admin using shared secret key
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  const { secretKey } = req.body || {};

  if (!secretKey) {
    return res.status(400).json({ message: 'Admin secret key is required' });
  }

  if (!process.env.ADMIN_SECRET_KEY) {
    console.error('ADMIN_SECRET_KEY is not configured in environment');
    return res.status(500).json({ message: 'Admin login is not configured' });
  }

  if (!isValidAdminSecret(secretKey)) {
    return res.status(401).json({ message: 'Invalid admin secret key' });
  }

  return res.status(200).json({
    token: generateToken({ role: 'admin' }),
    role: 'admin',
    tokenType: 'Bearer',
  });
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

// @desc    Check if email is available
// @route   GET /api/auth/check-email
// @access  Public
const checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ available: false, error: 'Email required' });
  }
  const user = await findUserByEmail(email);
  return res.status(200).json({ available: !user });
};

// @desc    Check if phone is available
// @route   GET /api/auth/check-phone
// @access  Public
const checkPhone = async (req, res) => {
  const { phone } = req.query;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ available: false, error: 'Phone required' });
  }
  const user = await findUserByPhone(phone);
  return res.status(200).json({ available: !user });
};

// @desc    Get manufacturer certification file
// @route   GET /api/auth/admin/manufacturers/:id/certification
// @access  Private (Admin)
const getCertificationFile = async (req, res) => {
  const path = require('path');
  const fs = require('fs');
  try {
    const m = await User.findById(req.params.id);
    if (!m || m.role !== 'manufacturer' || !m.certificationFile) {
      return res.status(404).json({ message: 'No certification file found for this manufacturer' });
    }

    // New format: file stored as binary in DB
    if (m.certificationFile.data) {
      res.set('Content-Type', m.certificationFile.contentType || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${m.certificationFile.fileName || 'document'}"`);
      return res.send(m.certificationFile.data);
    }

    // Old format: file stored as filename string on disk
    if (typeof m.certificationFile === 'string') {
      const filePath = path.join(process.cwd(), 'uploads', 'certifications', m.certificationFile);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
      return res.status(404).json({ message: 'File not found on disk' });
    }

    return res.status(404).json({ message: 'File not found' });
  } catch (error) {
    console.error('Error fetching certification file:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request email change — send 6-digit code to the NEW address
// @route   POST /api/auth/change-email
// @access  Private
async function requestEmailChange(req, res) {
  try {
    const { newEmail } = req.body;
    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ message: 'New email is required' });
    }
    const trimmedEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Check it's not already taken
    const existing = await findUserByEmail(trimmedEmail);
    if (existing) {
      return res.status(400).json({ message: 'This email address is already in use' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.email.toLowerCase() === trimmedEmail) {
      return res.status(400).json({ message: 'New email is the same as your current email' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    user.pendingEmail = trimmedEmail;
    user.emailChangeToken = codeHash;
    user.emailChangeTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    // Send verification email to the NEW address
    const fromName = process.env.EMAIL_FROM_NAME || 'BMP';
    const fromEmail = process.env.EMAIL_FROM || 'no-reply@bmp.tn';
    const transporter = getTransporter();
    const html = `
      <div style="font-family:Arial,sans-serif;padding:24px;max-width:480px;margin:auto;">
        <h2 style="color:#1E40AF;">Confirm your new email</h2>
        <p>We received a request to change the email address on your <strong>${fromName}</strong> account to this address.</p>
        <p>Your verification code is:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1E40AF;padding:16px 0;">${code}</div>
        <p style="color:#6B7280;font-size:13px;">This code expires in 15 minutes. If you did not request this change, you can safely ignore this email.</p>
      </div>`;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: trimmedEmail,
          subject: `${fromName} — confirm your new email address`,
          html,
        });
      } catch (emailErr) {
        console.error('Failed to send email-change verification:', emailErr.message);
      }
    }

    const responseBody = { message: 'Verification code sent to your new email address' };
    if (process.env.NODE_ENV !== 'production') {
      responseBody._devCode = code;
    }
    return res.status(200).json(responseBody);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Confirm email change with the 6-digit code
// @route   POST /api/auth/confirm-email-change
// @access  Private
async function confirmEmailChange(req, res) {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      _id: req.user._id,
      emailChangeToken: codeHash,
      emailChangeTokenExpires: { $gt: new Date() },
    });

    if (!user || !user.pendingEmail) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Double-check the new email is still free (race condition guard)
    const conflict = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: user._id },
    });
    if (conflict) {
      user.pendingEmail = undefined;
      user.emailChangeToken = undefined;
      user.emailChangeTokenExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'This email address was taken by another user, please choose a different one' });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Email updated successfully', email: user.email });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  adminLogin,
  getMe,
  checkEmail,
  checkPhone,
  checkResetOptions,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendPhoneVerification,
  verifyPhone,
  forgotPasswordPhone,
  resetPasswordPhone,
  updateProfile,
  requestEmailChange,
  confirmEmailChange,
  getPendingManufacturers,
  approveManufacturer,
  rejectManufacturer,
  listUsers,
  suspendUser,
  activateUser,
  deleteUser,
  getCertificationFile,
};

// Email utilities
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SERVICE } = process.env;
  
  // Option 1: Use a predefined service (like 'gmail')
  if (SMTP_SERVICE && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      service: SMTP_SERVICE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Force IPv4
      host: SMTP_SERVICE === 'gmail' ? 'smtp.gmail.com' : undefined
    });
  }

  // Option 2: Use custom SMTP host and port
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  
  return null;
}

async function sendResetEmail(email, resetUrl) {
  const fromName = process.env.EMAIL_FROM_NAME || 'BMP';
  const subject = `Reset your ${fromName} password`;
  const html = `<div style="font-family:Arial,sans-serif;padding:20px;"><h2>Reset your password</h2><p>We received a request to reset your password. Click the button below to set a new password:</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#1F3A8A;color:#fff;border-radius:8px;text-decoration:none;">Reset Password</a></p><p>If the button doesn't work, copy and paste this link into your browser:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in 1 hour.</p></div>`;
  
  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || 'no-reply@bmp.tn';
  const from = `"${fromName}" <${fromEmail}>`;

  if (transporter) {
    try {
      await transporter.sendMail({ from, to: email, subject, html });
      return;
    } catch (error) {
      console.error('Nodemailer send failed:', error);
    }
  }
  
  console.log('[DEV] Reset password URL:', resetUrl);
}

async function sendVerificationEmail(email, verificationUrl) {
  const fromName = process.env.EMAIL_FROM_NAME || 'BMP';
  const subject = `Verify your ${fromName} account`;
  const html = `<div style="font-family:Arial,sans-serif;padding:20px;"><h2>Welcome to ${fromName}!</h2><p>Thank you for joining us. Please click the button below to verify your email address and complete your registration:</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#1F3A8A;color:#fff;border-radius:8px;text-decoration:none;">Verify Email</a></p><p>If the button doesn't work, copy and paste this link into your browser:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link will expire in 24 hours.</p></div>`;
  
  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || 'no-reply@bmp.tn';
  const from = `"${fromName}" <${fromEmail}>`;

  if (transporter) {
    try {
      await transporter.sendMail({ from, to: email, subject, html });
      return;
    } catch (error) {
      console.error('Nodemailer verification email send failed:', error);
    }
  }
  
  console.log('[DEV] Verification URL:', verificationUrl);
}

// Normalize phone to E.164 format (handles Tunisian local numbers)
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const stripped = phone.replace(/[\s\-().]/g, '');
  if (stripped.startsWith('+')) return stripped;
  // 8-digit Tunisian local number (starts with 2,3,4,5,7,9)
  if (/^[2345789]\d{7}$/.test(stripped)) return `+216${stripped}`;
  // Already includes country code digits without +
  if (/^\d{10,}$/.test(stripped)) return `+${stripped}`;
  return stripped;
}

// SMS utilities - Dev/fallback logging (replace with your SMS service later)
async function sendSMS(phone, message) {
  const normalizedPhone = normalizePhone(phone);
  
  // Log to console so verification codes are still usable during development
  console.log(`\n[DEV SMS to ${normalizedPhone}]:\n  ${message}\n`);
  return { sent: false };
}

// @desc    Send phone verification code
// @route   POST /api/auth/phone/send-verification
// @access  Private
async function sendPhoneVerification(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if phone is already in use by another verified user
    const existingUser = await User.findOne({ phone, _id: { $ne: user._id }, isPhoneVerified: true });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already verified by another user' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // DO NOT update user.phone yet to prevent unverified number from being saved as primary
    // user.phone = phone; 
    user.phoneVerificationCode = codeHash;
    user.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    // Store the pending phone number in a temporary field or just use the code to verify the specific number sent
    user.pendingPhone = phone; 
    await user.save({ validateBeforeSave: false });

    const smsResult = await sendSMS(phone, `Your BMP verification code is: ${code}. Valid for 10 minutes.`);
    
    const responseBody = { message: 'Verification code sent' };
    // In non-production: include the code in the response so local testing works without real SMS
    if (process.env.NODE_ENV !== 'production') {
      responseBody._devCode = code;
      responseBody._smsSent = smsResult.sent;
      if (!smsResult.sent) {
        responseBody._devNote = 'SMS could not be delivered (check server console for the code). This field is only shown outside production.';
      }
    }
    return res.status(200).json(responseBody);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Verify phone number
// @route   POST /api/auth/phone/verify
// @access  Private
async function verifyPhone(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Verification code is required' });

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      _id: req.user._id,
      phoneVerificationCode: codeHash,
      phoneVerificationExpires: { $gt: new Date() },
    });

    if (!user || !user.pendingPhone) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.phone = user.pendingPhone;
    user.isPhoneVerified = true;
    user.pendingPhone = undefined;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Phone number verified successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Start password reset via SMS (lookup user by email, send to their verified phone)
// @route   POST /api/auth/phone/forgot
// @access  Public
async function forgotPasswordPhone(req, res) {
  try {
    const { phone, email } = req.body;
    // Support both old (phone) and new (email) lookup
    const user = email
      ? await User.findOne({ email, isPhoneVerified: true })
      : await User.findOne({ phone, isPhoneVerified: true });

    if (!user) {
      return res.status(200).json({ message: 'If that verified phone exists, a reset code was sent' });
    }
    const targetPhone = user.phone;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    user.resetPasswordToken = codeHash; // Reuse reset token field for SMS code
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });

    const smsResult = await sendSMS(targetPhone, `Your BMP password reset code is: ${code}. Valid for 10 minutes.`);

    const responseBody = { message: 'Reset code sent' };
    if (process.env.NODE_ENV !== 'production') {
      responseBody._devCode = code;
      responseBody._smsSent = smsResult.sent;
      if (!smsResult.sent) {
        responseBody._devNote = 'SMS could not be delivered. Check server console for the code.';
      }
    }
    return res.status(200).json(responseBody);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Complete password reset via SMS
// @route   POST /api/auth/phone/reset
// @access  Public
async function resetPasswordPhone(req, res) {
  try {
    const { phone, email, code, password } = req.body;
    if ((!phone && !email) || !code || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    // Support both email-based lookup (new flow) and phone-based lookup (legacy)
    const lookupField = email ? { email } : { phone };
    const user = await User.findOne({
      ...lookupField,
      resetPasswordToken: codeHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Check what reset methods are available for a given email
// @route   POST /api/auth/check-reset-options
// @access  Public
async function checkResetOptions(req, res) {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists — always respond with same shape
      return res.status(200).json({ hasVerifiedPhone: false });
    }
    return res.status(200).json({ hasVerifiedPhone: user.isPhoneVerified === true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Start password reset (send email)
// @route   POST /api/auth/forgot
// @access  Public
async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a reset link was sent' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    await sendResetEmail(email, resetUrl);
    return res.status(200).json({ message: 'Reset link sent if the email exists' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Complete password reset
// @route   POST /api/auth/reset
// @access  Public
async function resetPassword(req, res) {
  const { token, password } = req.body;
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
async function verifyEmail(req, res) {
  const { token } = req.body;
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      verificationToken: tokenHash,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { 
      firstName, 
      lastName, 
      profilePhoto,
      location, 
      domain, 
      bio, 
      specialization, 
      experience, 
      licenseNumber,
      credentials,
      institution,
      companyName,
      description,
      certificationNumber
    } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    
    // Role specific fields
    if (location !== undefined) user.location = location;
    if (domain !== undefined) user.domain = domain;
    if (bio !== undefined) user.bio = bio;
    if (specialization !== undefined) user.specialization = specialization;
    if (experience !== undefined) user.yearsExperience = experience;
    if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
    if (credentials !== undefined) user.credentials = credentials;
    if (institution !== undefined) user.institution = institution;
    if (companyName !== undefined) user.companyName = companyName;
    if (description !== undefined) user.description = description;
    if (certificationNumber !== undefined) user.certificationNumber = certificationNumber;

    const updatedUser = await user.save({ validateBeforeSave: false });

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      profilePhoto: updatedUser.profilePhoto,
      isPhoneVerified: updatedUser.isPhoneVerified,
      location: updatedUser.location,
      domain: updatedUser.domain,
      bio: updatedUser.bio,
      specialization: updatedUser.specialization,
      experience: updatedUser.yearsExperience,
      licenseNumber: updatedUser.licenseNumber,
      credentials: updatedUser.credentials,
      institution: updatedUser.institution,
      companyName: updatedUser.companyName,
      description: updatedUser.description,
      certificationNumber: updatedUser.certificationNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    List pending manufacturer applications
// @route   GET /api/auth/admin/manufacturers/pending
// @access  Private (Admin)
async function getPendingManufacturers(req, res) {
  try {
    const list = await Manufacturer.find({ verificationStatus: 'pending' }).select('-password');
    return res.status(200).json(list);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Approve manufacturer
// @route   POST /api/auth/admin/manufacturers/:id/approve
// @access  Private (Admin)
async function approveManufacturer(req, res) {
  try {
    const id = req.params.id;
    const m = await Manufacturer.findById(id);
    if (!m) return res.status(404).json({ message: 'Manufacturer not found' });
    m.verificationStatus = 'approved';
    m.reviewedAt = new Date();
    m.reviewedBy = req.user._id;
    m.rejectionReason = undefined;
    await m.save({ validateBeforeSave: false });

    // Send approval email
    const subject = 'Your BMP Manufacturer Account has been Approved!';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #1E40AF;">Congratulations!</h2>
        <p>Your manufacturer account for <strong>${m.companyName}</strong> has been approved by our administrators.</p>
        <p>You can now log in to your dashboard to manage your products and orders.</p>
        <p style="margin-top: 30px;">
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="background-color: #1E40AF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In Now</a>
        </p>
        <p style="margin-top: 40px; font-size: 0.9em; color: #666;">Best regards,<br>The BMP Team</p>
      </div>
    `;
    
    const transporter = getTransporter();
    if (transporter) {
      const fromEmail = process.env.EMAIL_FROM || 'no-reply@bmp.tn';
      const fromName = process.env.EMAIL_FROM_NAME || 'BMP';
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: m.email,
        subject,
        html
      });
    }

    return res.status(200).json({ message: 'Manufacturer approved' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Reject manufacturer
// @route   POST /api/auth/admin/manufacturers/:id/decline
// @access  Private (Admin)
async function rejectManufacturer(req, res) {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    const m = await Manufacturer.findById(id);
    if (!m) return res.status(404).json({ message: 'Manufacturer not found' });
    m.verificationStatus = 'rejected';
    m.reviewedAt = new Date();
    m.reviewedBy = req.user._id;
    m.rejectionReason = reason || 'No reason provided';
    await m.save({ validateBeforeSave: false });

    // Send rejection email
    const subject = 'Update regarding your BMP Manufacturer Application';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #EF4444;">Application Update</h2>
        <p>Thank you for your interest in joining BMP as a manufacturer.</p>
        <p>After reviewing your application for <strong>${m.companyName}</strong>, we regret to inform you that we cannot approve your account at this time.</p>
        <p><strong>Reason:</strong> ${m.rejectionReason}</p>
        <p>If you have any questions, please feel free to contact our support team.</p>
        <p style="margin-top: 40px; font-size: 0.9em; color: #666;">Best regards,<br>The BMP Team</p>
      </div>
    `;
    
    const transporter = getTransporter();
    if (transporter) {
      const fromEmail = process.env.EMAIL_FROM || 'no-reply@bmp.tn';
      const fromName = process.env.EMAIL_FROM_NAME || 'BMP';
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: m.email,
        subject,
        html
      });
    }

    // Delete the account as per workflow
    await m.deleteOne();

    return res.status(200).json({ message: 'Manufacturer rejected and account deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    List all users (basic info)
// @route   GET /api/auth/admin/users
// @access  Private (Admin)
async function listUsers(req, res) {
  try {
    const users = await User.find().select('firstName lastName email role status createdAt');
    return res.status(200).json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Suspend user
// @route   POST /api/auth/admin/users/:id/suspend
// @access  Private (Admin)
async function suspendUser(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = 'suspended';
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ message: 'User suspended' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Activate user
// @route   POST /api/auth/admin/users/:id/activate
// @access  Private (Admin)
async function activateUser(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = 'active';
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ message: 'User activated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Delete user
// @route   DELETE /api/auth/admin/users/:id
// @access  Private (Admin)
async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.deleteOne();
    return res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
}
