const { HttpError } = require('../lib/http');
const notFound = (req, res, next) => {
  next(Object.assign(new Error('Route not found.'), { status: 404, code: 'NOT_FOUND' }));
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const statusCode = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  const unexpected = statusCode >= 500 && !(err instanceof HttpError);
  res.status(statusCode).json({
    message: unexpected ? 'Internal Server Error' : err.message || 'Request failed.',
    code: unexpected ? 'INTERNAL_ERROR' : err.code || 'REQUEST_FAILED',
    ...(req.app.get('env') !== 'production' ? { stack: err.stack } : {}),
  });
};

module.exports = { notFound, errorHandler };
