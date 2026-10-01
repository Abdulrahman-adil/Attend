import json, re, zipfile, copy
from pathlib import Path
from xml.etree import ElementTree as E

BASE=Path(__file__).parent
META=json.loads((BASE/'metadata.json').read_text())
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
for k,v in NS.items(): E.register_namespace(k,v)
def tag(n):
 p,n=n.split(':');return '{'+NS[p]+'}'+n
def add(parent,name,attrs=None):return E.SubElement(parent,tag(name),{k:str(v) for k,v in (attrs or {}).items()})
def bounds(el):
 x=el.find('p:spPr/a:xfrm',NS)
 if x is None:return None
 off=x.find('a:off',NS); ext=x.find('a:ext',NS)
 if off is None or ext is None:return None
 return [int(off.get('x')),int(off.get('y')),int(ext.get('cx')),int(ext.get('cy'))]

def prepare_slide(data,m,num):
 root=E.fromstring(data)
 c=root.find('p:cSld',NS);c.set('name',m['id'])
 sp=c.find('p:spTree',NS)
 # Native text keeps logical Arabic order and explicit RTL paragraph direction.
 for tx in root.findall('.//p:txBody',NS):
  for par in tx.findall('a:p',NS):
   txt=''.join(t.text or '' for t in par.findall('.//a:t',NS))
   rtl=bool(re.search('[\u0600-\u06ff]',txt))
   pr=par.find('a:pPr',NS)
   if pr is None:pr=E.Element(tag('a:pPr'));par.insert(0,pr)
   pr.set('rtl','1' if rtl else '0')
   for rpr in par.findall('.//a:rPr',NS):
    rpr.set('lang','ar-EG' if rtl else 'en-US')
    if rtl:
     cs=rpr.find('a:cs',NS)
     if cs is None:cs=add(rpr,'a:cs')
     cs.set('typeface','.SF Arabic')
 # Group the browser, buttons, icons and labels into independently editable objects.
 groups={};order=[]
 for child in list(sp):
  n=child.find('p:nvSpPr/p:cNvPr',NS)
  if n is None:continue
  group=n.get('name','shape').split('/')[0]
  if group not in groups:groups[group]=[];order.append(group)
  groups[group].append(child)
 ids={}; nextid=max([int(x.get('id')) for x in root.findall('.//p:cNvPr',NS)]+[1])+1
 for key in order:
  items=groups[key]
  if len(items)==1:
   nv=items[0].find('p:nvSpPr/p:cNvPr',NS);nv.set('name','!!'+key);ids[key]=nv.get('id');continue
  grp=E.Element(tag('p:grpSp'))
  nv=add(grp,'p:nvGrpSpPr');add(nv,'p:cNvPr',{'id':nextid,'name':'!!'+key});add(nv,'p:cNvGrpSpPr');add(nv,'p:nvPr');ids[key]=str(nextid);nextid+=1
  xs=[bounds(s) for s in items];xs=[x for x in xs if x]
  x=min(q[0] for q in xs);y=min(q[1] for q in xs);w=max(q[0]+q[2] for q in xs)-x;h=max(q[1]+q[3] for q in xs)-y
  gp=add(grp,'p:grpSpPr');tr=add(gp,'a:xfrm')
  add(tr,'a:off',{'x':x,'y':y});add(tr,'a:ext',{'cx':max(w,1),'cy':max(h,1)});add(tr,'a:chOff',{'x':x,'y':y});add(tr,'a:chExt',{'cx':max(w,1),'cy':max(h,1)})
  pos=list(sp).index(items[0]);sp.insert(pos,grp)
  for item in items:sp.remove(item);grp.append(item)
 # Automatic slideshow transitions; Keynote version uses native Magic Move.
 tr=E.Element(tag('p:transition'),{'spd':'fast','advClick':'1','advTm':str(round(m['duration']*1000))});add(tr,'p:fade')
 clr=root.find('p:clrMapOvr',NS);root.insert(list(root).index(clr)+1 if clr is not None else 1,tr)
 # Timed native fade entrances and exits preserve editability and Build Order.
 if m['builds']:
  timing=add(root,'p:timing');tn=add(timing,'p:tnLst');par=add(tn,'p:par');ctr=add(par,'p:cTn',{'id':1,'dur':'indefinite','restart':'never','nodeType':'tmRoot'});cl=add(ctr,'p:childTnLst')
  seq=add(cl,'p:seq',{'concurrent':1,'nextAc':'seek'});main=add(seq,'p:cTn',{'id':2,'dur':'indefinite','nodeType':'mainSeq'});children=add(main,'p:childTnLst')
  outer=add(children,'p:par');oc=add(outer,'p:cTn',{'id':3,'fill':'hold'});starts=add(oc,'p:stCondLst');add(starts,'p:cond',{'delay':0});lst=add(oc,'p:childTnLst');nid=4
  for b in sorted(m['builds'],key=lambda b:b['delay']):
   if b['group'] not in ids:raise ValueError(b)
   effect=add(lst,'p:par');ct=add(effect,'p:cTn',{'id':nid,'presetID':10,'presetClass':'exit' if b['exit'] else 'entr','presetSubtype':0,'fill':'hold','nodeType':'withEffect'});nid+=1
   cond=add(ct,'p:stCondLst');add(cond,'p:cond',{'delay':round(b['delay']*1000)});effectlist=add(ct,'p:childTnLst')
   if not b['exit']:
    st=add(effectlist,'p:set');beh=add(st,'p:cBhvr');ctn=add(beh,'p:cTn',{'id':nid,'dur':1,'fill':'hold'});nid+=1
    sc=add(ctn,'p:stCondLst');add(sc,'p:cond',{'delay':0});t=add(beh,'p:tgtEl');add(t,'p:spTgt',{'spid':ids[b['group']]});names=add(beh,'p:attrNameLst');add(names,'p:attrName').text='style.visibility';to=add(st,'p:to');add(to,'p:strVal',{'val':'visible'})
   anim=add(effectlist,'p:animEffect',{'transition':'out' if b['exit'] else 'in','filter':'fade'});bh=add(anim,'p:cBhvr');add(bh,'p:cTn',{'id':nid,'dur':round(b['dur']*1000)});nid+=1
   tg=add(bh,'p:tgtEl');add(tg,'p:spTgt',{'spid':ids[b['group']]})
  prev=add(seq,'p:prevCondLst');co=add(prev,'p:cond',{'evt':'onPrev','delay':0});te=add(co,'p:tgtEl');add(te,'p:sldTgt')
  nxt=add(seq,'p:nextCondLst');co=add(nxt,'p:cond',{'evt':'onNext','delay':0});te=add(co,'p:tgtEl');add(te,'p:sldTgt')
  builds=add(timing,'p:bldLst')
  for key in dict.fromkeys(b['group'] for b in m['builds']):add(builds,'p:bldP',{'spid':ids[key],'grpId':0})
 return E.tostring(root,encoding='utf-8',xml_declaration=True)

with zipfile.ZipFile(BASE/'raw.pptx') as zi,zipfile.ZipFile(BASE/'candidate.pptx','w',zipfile.ZIP_DEFLATED) as zo:
 for item in zi.infolist():
  data=zi.read(item.filename)
  match=re.fullmatch(r'ppt/slides/slide(\d+)\.xml',item.filename)
  if match:
   n=int(match[1]);data=prepare_slide(data,META[n-1],n)
  zo.writestr(item,data)
print('Packaged native editable groups, Arabic RTL, and timed fades on 24 slides.')
