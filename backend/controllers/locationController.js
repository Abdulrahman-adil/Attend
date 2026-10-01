const { object,text,number,id,page,fail } = require('../lib/http');
const { locationDto } = require('../services/mappers');
const { audit } = require('../services/auditService');
function createLocationController({store,now}) {
  return {
    async list(req,res) {
      const {limit,offset}=page(req.query);
      const rows=await store.read(tx=>tx.all('SELECT * FROM locations WHERE company_id=? AND retired_at IS NULL ORDER BY name,id LIMIT ? OFFSET ?',[req.user.company_id,limit,offset]));
      res.json(rows.map(locationDto));
    },
    async add(req,res) {
      const body=object(req.body);const name=text(body.name,'Location name');
      const latitude=number(body.latitude,'Latitude',-90,90),longitude=number(body.longitude,'Longitude',-180,180),radius=number(body.radius,'Radius',1,100000);
      if (!Number.isInteger(radius)) fail(400,'Radius must be a whole number of meters.','VALIDATION');
      const row=await store.transaction(async tx=>{
        const created=await tx.run('INSERT INTO locations(company_id,name,latitude,longitude,radius) VALUES(?,?,?,?,?)',[req.user.company_id,name,latitude,longitude,radius]);
        await audit(tx,{companyId:req.user.company_id,actorId:req.user.id,type:'location.created',details:{locationId:created.lastID}},now().toISOString());
        return {id:created.lastID,company_id:req.user.company_id,name,latitude,longitude,radius};
      });
      res.status(201).json(locationDto(row));
    },
    async retire(req,res) {
      const locationId=id(req.params.id);
      await store.transaction(async tx=>{
        const changed=await tx.run('UPDATE locations SET retired_at=? WHERE id=? AND company_id=? AND retired_at IS NULL',[now().toISOString(),locationId,req.user.company_id]);
        if (!changed.changes) fail(404,'Location not found.','NOT_FOUND');
        await audit(tx,{companyId:req.user.company_id,actorId:req.user.id,type:'location.retired',details:{locationId}},now().toISOString());
      });
      res.json({message:'Location retired. Past records and existing checkouts remain available.'});
    },
  };
}
module.exports = { createLocationController };
