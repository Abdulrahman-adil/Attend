const { audit } = require('./auditService');

async function bootstrapAdmin(store, subject) {
  if (typeof subject !== 'string' || !/^[0-9]{1,255}$/.test(subject))
    throw new Error('INITIAL_ADMIN_GOOGLE_SUB must identify the existing Google-authenticated account.');
  return store.transaction(async tx => {
    await tx.get('SELECT pg_advisory_xact_lock(734221, 2)');
    if (await tx.get("SELECT id FROM users WHERE role='admin' LIMIT 1"))
      throw new Error('An administrator already exists; bootstrap is disabled.');
    const user = await tx.get('SELECT * FROM users WHERE google_id=$1 AND is_active=TRUE AND archived_at IS NULL FOR UPDATE', [subject]);
    if (!user) throw new Error('An active account must sign in with Google before bootstrap. No account was created.');
    await tx.run("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
    await audit(tx, { companyId: user.company_id, subjectId: user.id, type: 'account.initial_admin_established' }, new Date().toISOString());
  });
}
module.exports = { bootstrapAdmin };
