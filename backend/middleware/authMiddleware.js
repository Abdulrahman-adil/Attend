const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { fail, hash, wrap } = require("../lib/http");
function csrfToken(token, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update("csrf:" + token)
    .digest("hex");
}
function createAuth({ store, config, now }) {
  const cookieName = config.production
    ? "__Host-attend_session"
    : "attend_session";
  const setCookie = (res, token = "", maxAge = config.sessionMs) =>
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: config.production,
      sameSite: config.production ? "none" : "lax",
      path: "/",
      maxAge,
    });
  const protect = wrap(async (req, _res, next) => {
    _res.set('Cache-Control', 'no-store');
    const cookies = Object.fromEntries(
      (req.headers.cookie || "").split(";").map((s) => {
        const i = s.indexOf("=");
        return i < 0 ? ["", ""] : [s.slice(0, i).trim(), s.slice(i + 1)];
      })
    );
    const bearer = req.get("Authorization") || "";
    const bearerToken = /^Bearer ([A-Za-z0-9._-]+)$/.exec(bearer)?.[1];
    const token = cookies[cookieName] || bearerToken;
    if (!token) fail(401, "Please sign in.", "UNAUTHENTICATED");
    try {
      jwt.verify(token, config.secret, {
        algorithms: ["HS256"],
        issuer: "attend",
        audience: "attend",
        clockTimestamp: Math.floor(now().getTime() / 1000),
      });
    } catch {
      fail(
        401,
        "Your session has expired. Please sign in again.",
        "UNAUTHENTICATED"
      );
    }
    const sessionHash = hash(token);
    const user = await store.read((tx) =>
      tx.get(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.is_active=TRUE AND u.archived_at IS NULL",
        [sessionHash, now().toISOString()]
      )
    );
    if (!user)
      fail(
        401,
        "Your session is no longer active. Please sign in again.",
        "UNAUTHENTICATED"
      );
    req.user = user;
    req.sessionHash = sessionHash;
    req.sessionToken = token;
    req.csrfToken = csrfToken(token, config.secret);
    req.sessionTransport = cookies[cookieName] ? "cookie" : "bearer";
    if (
      req.sessionTransport === "cookie" &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    ) {
      const supplied = req.get("X-CSRF-Token") || "";
      const a = Buffer.from(supplied),
        b = Buffer.from(req.csrfToken);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
        fail(403, "Refresh the page and try again.", "CSRF_FAILED");
    }
    next();
  });
  const manager = (req, _res, next) => {
    if (
      (req.user.role !== "manager" && req.user.role !== "admin") ||
      !req.user.company_id
    )
      return next(
        Object.assign(new Error("Manager access is required."), {
          status: 403,
          code: "FORBIDDEN",
        })
      );
    next();
  };
  const employee = (req, _res, next) => {
    if (req.user.role !== "employee" || !req.user.company_id)
      return next(
        Object.assign(new Error("An assigned employee account is required."), {
          status: 403,
          code: "FORBIDDEN",
        })
      );
    next();
  };
  async function loginSession(tx, user, instant) {
    const token = jwt.sign(
      {
        id: user.id,
        nonce: crypto.randomBytes(24).toString("hex"),
        iat: Math.floor(instant.getTime() / 1000),
      },
      config.secret,
      {
        algorithm: "HS256",
        expiresIn: Math.floor(config.sessionMs / 1000),
        issuer: "attend",
        audience: "attend",
      }
    );
    await tx.run(
      "INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)",
      [
        hash(token),
        user.id,
        instant.toISOString(),
        new Date(instant.getTime() + config.sessionMs).toISOString(),
      ]
    );
    return { token, csrfToken: csrfToken(token, config.secret) };
  }
  return { protect, manager, employee, setCookie, loginSession };
}
module.exports = { createAuth };
