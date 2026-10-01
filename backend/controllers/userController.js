const { object,text,fail } = require('../lib/http');
const { timezone } = require('../lib/time');
const { userDto } = require('../services/mappers');
const { audit } = require('../services/auditService');
function createUserController({ store,now }) {
  return {
    async setRole(req,res) {
      const body=object(req.body);
      if (body.role!=='manager') fail(400,'Employees join through an invitation from their organization.','INVITATION_REQUIRED');
      const name=text(body.companyName,'Organization name');const zone=timezone(body.timezone);const time=now().toISOString();
      const user=await store.transaction(async tx=>{
        const current=await tx.get('SELECT * FROM users WHERE id=?',[req.user.id]);
        if (current.role || current.company_id) fail(409,'This account already belongs to an organization.','ROLE_ALREADY_SET');
        const company=await tx.run('INSERT INTO companies(name,owner_id,timezone,timezone_configured) VALUES(?,?,?,1)',[name,current.id,zone]);
        await tx.run("UPDATE users SET role='manager',company_id=? WHERE id=?",[company.lastID,current.id]);
        await audit(tx,{companyId:company.lastID,actorId:current.id,subjectId:current.id,type:'organization.created'},time);
        return {...current,role:'manager',company_id:company.lastID};
      });
      res.json({user:userDto(user),message:'Organization created.'});
    },
  };
}
module.exports = { createUserController };
