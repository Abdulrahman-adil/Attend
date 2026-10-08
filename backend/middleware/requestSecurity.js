const { hash } = require('../lib/http');

function requestSecurity(config) {
  // Bounded per-process limiter: complements provider protection, not a distributed guarantee.
  const buckets = new Map();
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && origin !== config.frontendUrl)
      return res.status(403).json({ message: 'Origin is not allowed.', code: 'ORIGIN_DENIED' });
    if (req.method !== 'POST' || !['/login', '/register', '/google', '/request-link', '/activate'].includes(req.path)) return next();
    if (!req.is('application/json')) return res.status(415).json({ message: 'Send application/json.', code: 'JSON_REQUIRED' });
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
    // Do not trust user-controlled X-Forwarded-For. Behind Render this is a conservative
    // shared limit unless the deployment explicitly configures and verifies proxy trust.
    const keys = ['ip:' + req.ip];
    if (typeof req.body?.email === 'string') keys.push('account:' + hash(req.body.email.trim().toLowerCase()));
    for (const key of keys) {
      const bucket = buckets.get(key) || { count: 0, until: now + 60000 };
      if ((!buckets.has(key) && buckets.size >= 10000) || ++bucket.count > (key.startsWith('ip:') ? 100 : 10)) {
        res.set('Retry-After', '60');
        return res.status(429).json({ message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
      }
      buckets.set(key, bucket);
    }
    next();
  };
}
module.exports = { requestSecurity };
