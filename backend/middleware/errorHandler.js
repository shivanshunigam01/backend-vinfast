module.exports = (err, req, res, next) => {
  console.error(err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token invalid.' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return res.status(409).json({ success: false, message: `${field} already exists.` });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') || 'Validation failed.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
