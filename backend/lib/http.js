const crypto = require('node:crypto');
class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new HttpError(status, message, code); };
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
const object = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'A JSON object is required.', 'INVALID_BODY');
  return value;
};
const text = (value, label, min = 1, max = 160) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${label} must contain ${min}–${max} characters.`, 'VALIDATION');
  return value.trim();
};
const email = value => {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@<>(),;:\\"]+@[^\s@<>(),;:\\"]+\.[^\s@<>(),;:\\"]+$/.test(result)) fail(400, 'Enter a valid email address.', 'VALIDATION');
  return result;
};
const password = value => {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) fail(400, 'Use a password of at least 12 characters and at most 72 UTF-8 bytes.', 'VALIDATION');
  return value;
};
const number = (value, label, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(400, `${label} must be between ${min} and ${max}.`, 'VALIDATION');
  return value;
};
const id = value => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(400, 'Invalid identifier.', 'VALIDATION');
  return Number(value);
};
const page = query => {
  const limit = query.limit === undefined ? 50 : id(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, 'Invalid pagination.', 'VALIDATION');
  return { limit, offset };
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
module.exports = { HttpError, fail, wrap, object, text, email, password, number, id, page, hash };
