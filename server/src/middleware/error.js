const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler: every error leaves the API in the same JSON shape
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors;

  if (err.name === 'ValidationError') {        // Mongoose schema validation
    status = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {       // Bad ObjectId
    status = 400;
    message = `Invalid ${err.path}`;
    errors = undefined;
  } else if (err.code === 11000) {             // Duplicate key
    status = 409;
    message = `${Object.keys(err.keyValue || {}).join(', ') || 'Value'} already exists`;
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({ success: false, message, ...(errors && { errors }) });
}

module.exports = { notFound, errorHandler };
