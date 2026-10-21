const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after express-validator rules and returns a 422 with field errors
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'Validation failed', errors));
}

module.exports = validate;
