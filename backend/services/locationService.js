const { number,id,fail } = require('../lib/http');
const distance = (a,b,lat,lon) => {
  const rad=x=>x*Math.PI/180;const dlat=rad(lat-a),dlon=rad(lon-b);
  const x=Math.sin(dlat/2)**2+Math.cos(rad(a))*Math.cos(rad(lat))*Math.sin(dlon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,x)),Math.sqrt(Math.max(0,1-x)));
};
function position(body) {
  return {
    latitude:number(body.latitude,'Latitude',-90,90),longitude:number(body.longitude,'Longitude',-180,180),locationId:id(body.locationId),
    accuracy:body.accuracy===undefined?null:number(body.accuracy,'Location accuracy',0,10000),
  };
}
async function validateLocation(tx,companyId,sample,{allowRetired=false}={}) {
  const location=await tx.get('SELECT * FROM locations WHERE id=? AND company_id=?',[sample.locationId,companyId]);
  if (!location || (location.retired_at && !allowRetired)) fail(404,'Work location not found.','LOCATION_NOT_FOUND');
  if (sample.accuracy!==null && sample.accuracy>location.radius) fail(422,'Your location is not accurate enough. Move to an open area and refresh location.','LOCATION_IMPRECISE');
  if (distance(sample.latitude,sample.longitude,location.latitude,location.longitude)>location.radius) fail(403,'You are outside the selected work location.','OUTSIDE_LOCATION');
  return location;
}
module.exports = { distance,position,validateLocation };
