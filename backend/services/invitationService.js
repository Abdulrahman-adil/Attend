const crypto = require('node:crypto');
const { hash } = require('../lib/http');
const { queueEmail } = require('./emailService');
async function issueInvitation(tx, config, user, kind, actorId, instant) {
  const time = instant.toISOString();
  await tx.run("UPDATE email_outbox SET status='cancelled',payload_encrypted=NULL WHERE invitation_id IN (SELECT id FROM invitations WHERE user_id=? AND kind=?) AND status IN ('pending','failed')",[user.id,kind]);
  await tx.run('UPDATE invitations SET revoked_at=? WHERE user_id=? AND kind=? AND consumed_at IS NULL AND revoked_at IS NULL',[time,user.id,kind]);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(instant.getTime()+(kind === 'password_reset' ? 3600000 : config.invitationMs)).toISOString();
  const invite = await tx.run('INSERT INTO invitations(user_id,company_id,token_hash,kind,created_at,expires_at,created_by) VALUES(?,?,?,?,?,?,?)',[user.id,user.company_id,hash(token),kind,time,expiresAt,actorId]);
  await queueEmail(tx,config,{ eventKey:`invitation:${invite.lastID}`,companyId:user.company_id,invitationId:invite.lastID,kind,payload:{to:user.email,name:user.name,token,expiresAt} },time);
  if (kind === 'invitation') await tx.run('UPDATE users SET invited_at=? WHERE id=?',[time,user.id]);
  return invite.lastID;
}
module.exports = { issueInvitation };
