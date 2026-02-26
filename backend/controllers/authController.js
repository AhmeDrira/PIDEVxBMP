const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dns = require('dns');
const axios = require('axios');
const { User, Artisan, Expert, Manufacturer, Admin } = require('../models/User');

// Verify Google reCAPTCHA token
async function verifyCaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET_KEY not set — skipping verification');
    return true;
  }
  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      { params: { secret, response: token } }
    );
    return response.data.success === true;
  } catch (err) {
    console.error('reCAPTCHA verification error:', err.message);
    return false;
  }
}

// Force IPv4 for network connections (fixes ENETUNREACH errors on some networks)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
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
    phone, 
    password, 
    role,
    // Role specific fields
    location,
    domain,
    yearsExperience,
    companyName,
    certificationFile 
  } = req.body;

  try {
    if (!firstName || !lastName || !email || !password || !phone || !role) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Check if user exists (email and phone must be unique)
    const userByEmail = await findUserByEmail(email);
    if (userByEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const userByPhone = await findUserByPhone(phone);
    if (userByPhone) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    let user;

    switch (role) {
      case 'artisan':
        if (!location || !domain) {
           return res.status(400).json({ message: 'Artisan requires location and domain' });
        }
        user = await Artisan.create({
          firstName, lastName, email, phone, password, role,
          location, domain, yearsExperience
        });
        break;
      
      case 'expert':
        if (!domain) {
           return res.status(400).json({ message: 'Expert requires domain' });
        }
        user = await Expert.create({
          firstName, lastName, email, phone, password, role,
          domain
        });
        break;
      
      case 'manufacturer':
        if (!companyName) {
           return res.status(400).json({ message: 'Manufacturer requires company name' });
        }
        
        let certData = null;
        if (req.file) {
          certData = {
            data: req.file.buffer,
            contentType: req.file.mimetype,
            fileName: req.file.originalname
          };
        }

        user = await Manufacturer.create({
          firstName, lastName, email, phone, password, role,
          companyName, certificationFile: certData
        });
        break;

      case 'admin':
        return res.status(403).json({ message: 'Admin registration is restricted' });

      default:
        return res.status(400).json({ message: 'Invalid role' });
    }

    if (user) {
      res.status(201).json({
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
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
  const { email, password, captchaToken } = req.body;

  try {
    // Verify reCAPTCHA
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ message: 'CAPTCHA verification failed. Please try again.' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
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

// @desc    Create Admin User
// @route   POST /api/auth/admin/create
// @access  Public (Dev-controlled UI)
const createAdmin = async (req, res) => {
  const { 
    firstName, 
    lastName, 
    email, 
    phone, 
    password 
  } = req.body;

  try {
    const userByEmail = await findUserByEmail(email);
    if (userByEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const userByPhone = await findUserByPhone(phone);
    if (userByPhone) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    const user = await Admin.create({
      firstName, 
      lastName, 
      email, 
      phone, 
      password,
      role: 'admin'
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
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

module.exports = {
  registerUser,
  loginUser,
  createAdmin,
  getMe,
  checkEmail,
  checkPhone,
  forgotPassword,
  resetPassword,
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
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}&role=${user.role}`;

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
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
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
