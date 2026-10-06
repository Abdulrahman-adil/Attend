const bcrypt = require("bcryptjs");
const { object, text, email, password, hash, fail } = require("../lib/http");
const { userDto } = require("../services/mappers");
const { audit } = require("../services/auditService");
const { issueInvitation } = require("../services/invitationService");
const { queueEmail } = require("../services/emailService");
function createAuthController({ store, config, now, auth, googleIdentity }) {
  const tokenValue = (body) => {
    const token = text(object(body).token, "Invitation token", 40, 128);
    if (!/^[a-f0-9]+$/.test(token))
      fail(400, "This invitation is invalid.", "INVALID_INVITATION");
    return token;
  };
  const findInvitation = (tx, token, instant) =>
    tx.get(
      "SELECT i.*,u.name,u.email,u.role,u.company_id AS user_company_id,u.is_active,u.archived_at FROM invitations i JOIN users u ON u.id=i.user_id WHERE i.token_hash=?",
      [hash(token)]
    );
  const ensureValid = (inv, instant) => {
    if (
      !inv ||
      inv.revoked_at ||
      inv.consumed_at ||
      inv.archived_at ||
      inv.expires_at <= instant.toISOString()
    )
      fail(
        410,
        "This link has already been used, replaced, or expired. Request a new link.",
        "INVITATION_UNAVAILABLE"
      );
    if (inv.company_id !== inv.user_company_id)
      fail(
        410,
        "This invitation is no longer valid.",
        "INVITATION_UNAVAILABLE"
      );
  };
  return {
    async register(req, res) {
      const body = object(req.body);
      const name = text(body.name, "Name");
      const address = email(body.email);
      const pass = password(body.password);
      const encoded = await bcrypt.hash(pass, 12);
      const instant = now();
      await store.transaction(async (tx) => {
        if (
          await tx.get("SELECT id FROM users WHERE normalized_email=?", [
            address,
          ])
        )
          fail(
            409,
            "An account with this email already exists. Sign in or request a new activation link.",
            "ACCOUNT_EXISTS"
          );
        const user = await tx.run(
          "INSERT INTO users(name,email,normalized_email,password,created_at) VALUES(?,?,?,?,?)RETURNING id",
          [name, address, address, encoded, instant.toISOString()]
        );
        await issueInvitation(
          tx,
          config,
          { id: user.lastID, name, email: address, company_id: null },
          "activation",
          user.lastID,
          instant
        );
        await audit(
          tx,
          {
            actorId: user.lastID,
            subjectId: user.lastID,
            type: "account.registered",
          },
          instant.toISOString()
        );
      });
      res.status(201).json({
        message: "Account created. An activation email is queued for delivery.",
        delivery: config.emailEnabled ? "queued" : "disabled",
      });
    },
    async login(req, res) {
      const body = object(req.body);
      const address = email(body.email);
      if (
        typeof body.password !== "string" ||
        !body.password.length ||
        Buffer.byteLength(body.password) > 72
      )
        fail(400, "Enter your email and password.", "VALIDATION");
      const user = await store.read((tx) =>
        tx.get("SELECT * FROM users WHERE normalized_email=?", [address])
      );
      // A fixed valid hash keeps non-existing-account checks on the bcrypt path as well.
      const encoded =
        user?.password && /^\$2[aby]\$/.test(user.password)
          ? user.password
          : "$2b$12$YAWOTSWbABebkxAuSoUFMeFiOBH.2SMKNIRakzSV8NF87CMDwtTPu";
      const matches = await bcrypt.compare(body.password, encoded);
      if (!user || !matches || user.archived_at || !user.is_active)
        fail(
          401,
          "Invalid credentials or inactive account. Use a new activation link if needed.",
          "INVALID_CREDENTIALS"
        );
      const instant = now();
      const session = await store.transaction(async (tx) => {
        const current = await tx.get(
          "SELECT * FROM users WHERE id=? AND is_active=1 AND archived_at IS NULL AND password=?",
          [user.id, user.password]
        );
        if (!current)
          fail(
            401,
            "Account credentials changed. Please sign in again.",
            "INVALID_CREDENTIALS"
          );
        return auth.loginSession(tx, current, instant);
      });
      auth.setCookie(res, session.token);
      res.json({
        user: userDto(user),
        csrfToken: session.csrfToken,
        serverTime: instant.toISOString(),
      });
    },
    async googleLogin(req, res) {
      const body = object(req.body);
      const credential = text(body.credential, "Google credential", 100, 12000);
      if (
        body.platform !== undefined &&
        body.platform !== "web" &&
        body.platform !== "mobile"
      )
        fail(400, "Google platform must be web or mobile.", "VALIDATION");
      const platform = body.platform || "web";
      const identity = await googleIdentity.verify(credential);
      const address = email(identity.email);
      const name = text(identity.name, "Google account name");
      const instant = now();
      const user = await store.transaction(async (tx) => {
        const adminCountRow = await tx.get(
          "SELECT COUNT(*) AS count FROM users WHERE role='admin'"
        );
        const hasAdmin = (adminCountRow?.count || 0) > 0;
        const targetRole = hasAdmin ? null : "admin";
        let current = await tx.get("SELECT * FROM users WHERE google_id=?", [
          identity.subject,
        ]);
        if (current) {
          if (targetRole && current.role !== "admin") {
            await tx.run("UPDATE users SET role=? WHERE id=?", [
              targetRole,
              current.id,
            ]);
            current = { ...current, role: targetRole };
          }
        } else {
          const byEmail = await tx.get(
            "SELECT * FROM users WHERE normalized_email=?",
            [address]
          );
          if (byEmail) {
            if (byEmail.google_id && byEmail.google_id !== identity.subject)
              fail(
                409,
                "This email is already linked to another Google account.",
                "GOOGLE_ACCOUNT_CONFLICT"
              );
            if (!byEmail.is_active || byEmail.archived_at)
              fail(
                403,
                "Activate your existing account through its invitation before using Google sign-in.",
                "ACTIVATION_REQUIRED"
              );
            await tx.run("UPDATE users SET google_id=?, role=COALESCE(?, role) WHERE id=?", [
              identity.subject,
              targetRole,
              byEmail.id,
            ]);
            const updated = await tx.get("SELECT * FROM users WHERE id=?", [byEmail.id]);
            current = { ...updated, google_id: identity.subject };
            await audit(
              tx,
              {
                companyId: current.company_id,
                actorId: current.id,
                subjectId: current.id,
                type: "account.google_linked",
              },
              instant.toISOString()
            );
          } else {
            const insertSql = targetRole
              ? "INSERT INTO users(name,email,normalized_email,google_id,role,is_active,created_at,activated_at) VALUES(?,?,?,?,?,TRUE,?,?)"
              : "INSERT INTO users(name,email,normalized_email,google_id,is_active,created_at,activated_at) VALUES(?,?,?,?,TRUE,?,?)";
            const inserted = targetRole
              ? await tx.run(insertSql, [
                  name,
                  address,
                  address,
                  identity.subject,
                  targetRole,
                  instant.toISOString(),
                  instant.toISOString(),
                ])
              : await tx.run(insertSql, [
                  name,
                  address,
                  address,
                  identity.subject,
                  instant.toISOString(),
                  instant.toISOString(),
                ]);
            current = await tx.get("SELECT * FROM users WHERE id=?", [
              inserted.lastID,
            ]);
            await audit(
              tx,
              {
                actorId: current.id,
                subjectId: current.id,
                type: "account.google_registered",
              },
              instant.toISOString()
            );
          }
        }
        if (!current.is_active || current.archived_at)
          fail(
            401,
            "This Google-linked account is inactive.",
            "INVALID_CREDENTIALS"
          );
        return current;
      });
      const session = await store.transaction((tx) =>
        auth.loginSession(tx, user, instant)
      );
      const payload = {
        user: userDto(user),
        serverTime: instant.toISOString(),
      };
      if (platform === "mobile")
        return res.json({
          ...payload,
          accessToken: session.token,
          expiresIn: Math.floor(config.sessionMs / 1000),
        });
      auth.setCookie(res, session.token);
      res.json({ ...payload, csrfToken: session.csrfToken });
    },
    async session(req, res) {
      res.json({
        user: userDto(req.user),
        csrfToken: req.csrfToken,
        serverTime: now().toISOString(),
      });
    },
    async logout(req, res) {
      await store.transaction((tx) =>
        tx.run("UPDATE sessions SET revoked_at=? WHERE token_hash=?", [
          now().toISOString(),
          req.sessionHash,
        ])
      );
      auth.setCookie(res, "", 0);
      res.json({ message: "Signed out." });
    },
    async inspectInvitation(req, res) {
      const token = tokenValue(req.body);
      const instant = now();
      const invitation = await store.read((tx) =>
        findInvitation(tx, token, instant)
      );
      ensureValid(invitation, instant);
      res.json({
        kind: invitation.kind,
        requiresPassword: invitation.kind !== "activation",
        expiresAt: invitation.expires_at,
      });
    },
    async activate(req, res) {
      const token = tokenValue(req.body);
      const instant = now();
      const pending = await store.read((tx) =>
        findInvitation(tx, token, instant)
      );
      ensureValid(pending, instant);
      const encoded =
        pending.kind === "activation"
          ? null
          : await bcrypt.hash(password(req.body.password), 12);
      await store.transaction(async (tx) => {
        const inv = await findInvitation(tx, token, instant);
        ensureValid(inv, instant);
        const time = instant.toISOString();
        const consumed = await tx.run(
          "UPDATE invitations SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>?",
          [time, inv.id, time]
        );
        if (consumed.changes !== 1)
          fail(
            410,
            "This link has already been used.",
            "INVITATION_UNAVAILABLE"
          );
        if (inv.kind === "password_reset") {
          await tx.run(
            "UPDATE users SET password=?,google_id=NULL WHERE id=?",
            [encoded, inv.user_id]
          );
          await tx.run(
            "UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
            [time, inv.user_id]
          );
          await audit(
            tx,
            {
              companyId: inv.company_id,
              actorId: inv.user_id,
              subjectId: inv.user_id,
              type: "account.password_reset",
            },
            time
          );
        } else {
          if (inv.is_active)
            fail(
              410,
              "This account is already active.",
              "INVITATION_UNAVAILABLE"
            );
          await tx.run(
            "UPDATE users SET is_active=TRUE,activated_at=?,password=COALESCE(?,password),google_id=NULL WHERE id=?",
            [time, encoded, inv.user_id]
          );
          await audit(
            tx,
            {
              companyId: inv.company_id,
              actorId: inv.user_id,
              subjectId: inv.user_id,
              type:
                inv.role === "employee"
                  ? "employee.activated"
                  : "account.activated",
            },
            time
          );
          await queueEmail(
            tx,
            config,
            {
              eventKey: `activation:${inv.user_id}:employee`,
              companyId: inv.company_id,
              kind: "activation_confirmation",
              payload: { to: inv.email, name: inv.name, time },
            },
            time
          );
          if (inv.company_id) {
            const owner = await tx.get(
              "SELECT u.email FROM users u JOIN companies c ON c.owner_id=u.id WHERE c.id=?",
              [inv.company_id]
            );
            if (owner && owner.email !== inv.email)
              await queueEmail(
                tx,
                config,
                {
                  eventKey: `activation:${inv.user_id}:manager`,
                  companyId: inv.company_id,
                  kind: "activation_manager",
                  payload: { to: owner.email, name: inv.name, time },
                },
                time
              );
          }
        }
      });
      res.json({
        message:
          pending.kind === "password_reset"
            ? "Password updated. Sign in with your new password."
            : "Your account is active. You can now sign in with your email address.",
      });
    },
    async requestLink(req, res) {
      const body = object(req.body);
      const address = email(body.email);
      const kind =
        body.kind === "password_reset" ? "password_reset" : "activation";
      const instant = now();
      await store.transaction(async (tx) => {
        const user = await tx.get(
          "SELECT * FROM users WHERE normalized_email=? AND archived_at IS NULL",
          [address]
        );
        if (
          !user ||
          (kind === "password_reset" ? !user.is_active : user.is_active)
        )
          return;
        const purpose =
          kind === "password_reset"
            ? kind
            : user.role === "employee"
            ? "invitation"
            : "activation";
        const recent = await tx.get(
          "SELECT created_at FROM invitations WHERE user_id=? AND kind=? ORDER BY id DESC LIMIT 1",
          [user.id, purpose]
        );
        if (
          recent?.created_at &&
          instant.getTime() - Date.parse(recent.created_at) < 60000
        )
          return;
        await issueInvitation(tx, config, user, purpose, null, instant);
        await audit(
          tx,
          {
            companyId: user.company_id,
            subjectId: user.id,
            type: "account.link_requested",
            details: { kind: purpose },
          },
          instant.toISOString()
        );
      });
      res.json({
        message:
          "If this account is eligible, a new link will be emailed. Check your inbox and spam folder.",
      });
    },
  };
}
module.exports = { createAuthController };
