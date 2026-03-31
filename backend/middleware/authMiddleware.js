const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

const superAdminPermissions = {
  canVerifyManufacturers: true,
  canManageKnowledge: true,
  canSuspendUsers: true,
  canManageReports: true,
  canDeleteUsers: true,
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded && decoded.role === 'admin') {
        req.user = {
          role: 'admin',
          isSuperAdmin: true,
          adminType: 'super',
          permissions: superAdminPermissions,
        };
        return next();
      }

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin' && (req.user.isSuperAdmin || req.user.adminType === 'super')) {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized as a super admin' });
};

module.exports = { protect, admin, superAdminOnly };
