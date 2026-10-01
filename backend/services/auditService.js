async function audit(tx, { companyId = null, actorId = null, subjectId = null, type, details = {} }, now) {
  return tx.run('INSERT INTO audit_events(company_id,actor_id,subject_id,event_type,occurred_at,details_json) VALUES(?,?,?,?,?,?)',[companyId,actorId,subjectId,type,now,JSON.stringify(details)]);
}
module.exports = { audit };
