const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtSecret = () => process.env.JWT_SECRET || 'usp-local-secret';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret());
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again' });
  }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'You do not have permission to access this area' });
};

module.exports = {
  protect,
  allowRoles,
  adminOnly: allowRoles('admin'),
  staffOnly: allowRoles('admin', 'coordinator'),
};
