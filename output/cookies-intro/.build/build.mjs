import fs from 'node:fs/promises';
import path from 'node:path';
import {Presentation, PresentationFile} from '@oai/artifact-tool';
import {FontLibrary} from '/Users/abdoadel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.js';

const ROOT=path.resolve(import.meta.dirname,'..');
const TMP=import.meta.dirname;
const C={navy:'#0A0E27',black:'#000000',cyan:'#00D9FF',purple:'#8B7BFF',amber:'#FFB800',white:'#F5F7FA',gray:'#8A93A6',coral:'#FF7A59',mint:'#34E5A8',panel:'#12172E'};
const F={ar:'.SF Arabic',en:'.SF NS',mono:'.SF NS Mono'};
FontLibrary.use(F.ar,'/System/Library/Fonts/SFArabic.ttf');
FontLibrary.use(F.en,'/System/Library/Fonts/SFNS.ttf');
FontLibrary.use(F.mono,'/System/Library/Fonts/SFNSMono.ttf');
const p=Presentation.create({slideSize:{width:1920,height:1080}});
const source=await fs.readFile('/Users/abdoadel/.codex/attachments/e72d04ad-b7e6-4fb3-9866-7bd7899a04a4/pasted-text.txt','utf8');
const scenes=source.split(/### المشهد /).slice(1).map(s=>s.split('\n---')[0]);
const meta=[]; let slide, index=0, counter=0;

function addSlide(scene,part,duration,transition='magic move'){
 slide=p.slides.add();counter=0;
 slide.background.fill={type:'gradient',gradientKind:'linear',angleDeg:45,stops:[{offset:0,color:C.navy},{offset:100000,color:C.black}]};
 const id=`S${scene}-${part}`, start=meta.reduce((a,s)=>a+s.duration,0);
 const m={id,scene,part,duration,start,transition,builds:[]};meta.push(m);
 const text=scenes[scene-1]; const narration=text.match(/\*\*تعليق صوتي:\*\* ([^\n]+)/)?.[1]??'';
 slide.speakerNotes.textFrame.setText(`${id}\nالمشهد ${scene} — ${text.split('\n')[0].replace(/^\d+ — /,'')}\nزمن هذه الشريحة: ${start.toFixed(1)}–${(start+duration).toFixed(1)} ثانية.\n\nالتعليق الصوتي للمشهد:\n${narration}\n\nتوجيهات الحركة والتوقيت من المخطط:\n${text.substring(text.indexOf('| #'),text.indexOf('**تعليق صوتي:')).trim()}\n\nالمؤثرات الصوتية أسماء مقترحة فقط؛ لا توجد ملفات صوتية مضمّنة.`);
 return slide;
}
function build(group,delay=0,dur=.4,effect='fade',exit=false){meta.at(-1).builds.push({group,delay,dur,effect,exit});}
function sh(g,geometry,x,y,w,h,fill='none',stroke='none',lw=0,extra={}){
 return slide.shapes.add({name:`${g}/${++counter}`,geometry,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:lw,style:'solid'},...extra});
}
function rect(g,x,y,w,h,fill=C.panel,stroke='none',lw=0,r=20){return sh(g,'roundRect',x,y,w,h,fill,stroke,lw,{borderRadius:r});}
function circ(g,x,y,d,fill,stroke='none',lw=0){return sh(g,'ellipse',x,y,d,d,fill,stroke,lw);}
function text(g,t,x,y,w,h,size=40,col=C.white,bold=false,align='center',font){
 let q=sh(g,'textbox',x,y,w,h);q.text=t;
 q.text.style={typeface:font??(/[\u0600-\u06ff]/.test(t)?F.ar:F.en),fontSize:size,color:col,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',wrap:'none',insets:{top:0,left:0,bottom:0,right:0}};
 return q;
}
function line(g,x1,y1,x2,y2,col=C.cyan,lw=2,dashed=false){
 return sh(g,'line',Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1),'none',col,lw,{position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1),verticalFlip:(x2-x1)*(y2-y1)<0},line:{fill:col,width:lw,style:dashed?'dashed':'solid'}});
}
function pathShape(g,pts,x,y,w,h,col,lw=5,fill='none',close=false){
 return sh(g,'custom',x,y,w,h,fill,col,lw,{customPaths:[{width:100,height:100,commands:[{moveTo:{x:pts[0][0],y:pts[0][1]}},...pts.slice(1).map(a=>({lineTo:{x:a[0],y:a[1]}})),...(close?[{close:{}}]:[])]}]});
}
function cookie(g,x,y,d=160){
 circ(g,x,y,d,C.amber);
 [[.3,.24,.115],[.61,.2,.08],[.7,.47,.13],[.37,.57,.12],[.55,.78,.08],[.19,.74,.065]].forEach(([a,b,c])=>circ(g,x+a*d,y+b*d,d*c,'#774900'));
}
function fileIcon(g,x,y,d,col=C.amber){
 circ(g,x,y,d,C.amber+'/8',col,2);
 pathShape(g,[[30,17],[59,17],[74,32],[74,80],[30,80]],x,y,d,d,col,5,'none',true);
 pathShape(g,[[59,17],[59,32],[74,32]],x,y,d,d,col,4);
 [46,58,70].forEach((a,i)=>line(g,x+d*.39,y+d*a/100,x+d*(i===2?.57:.64),y+d*a/100,col,4));
}
function cursor(g,x,y,d=48){pathShape(g,[[10,4],[10,83],[31,64],[48,96],[63,87],[45,57],[73,57]],x,y,d,d,'#080B15',2,C.white,true);}
function clock(g,x,y,d=110){circ(g,x,y,d,'none',C.gray,5);pathShape(g,[[50,19],[50,52],[69,62]],x,y,d,d,C.white,5);}
function userIcon(g,x,y,d,col=C.purple){circ(g,x+d*.34,y,d*.32,'none',col,5);pathShape(g,[[16,91],[16,77],[22,60],[35,51],[65,51],[78,60],[84,77],[84,91]],x,y,d,d,col,5);}
function browserIcon(g,x,y,d,col=C.cyan){rect(g,x,y,d,d*.7,'none',col,5,10);line(g,x,y+d*.18,x+d,y+d*.18,col,4);circ(g,x+d*.09,y+d*.07,d*.045,col);circ(g,x+d*.18,y+d*.07,d*.045,col);}
function serverIcon(g,x,y,d,col=C.purple){for(let i=0;i<3;i++){rect(g,x,y+i*d*.28,d,d*.22,'none',col,4,8);circ(g,x+d*.1,y+i*d*.28+d*.08,d*.05,col);line(g,x+d*.28,y+i*d*.28+d*.105,x+d*.8,y+i*d*.28+d*.105,col,3);}}
function cart(g,x,y,d=250,products=true){
 if(products){rect(g,x+d*.31,y+d*.18,d*.26,d*.32,C.purple,'none',0,7);rect(g,x+d*.58,y+d*.1,d*.26,d*.4,C.amber,'none',0,7);}
 pathShape(g,[[2,12],[16,12],[30,67],[80,67],[91,27],[21,27]],x,y,d,d,C.cyan,6);
 line(g,x+d*.34,y+d*.76,x+d*.79,y+d*.76,C.cyan,5);
 circ(g,x+d*.31,y+d*.84,d*.1,'none',C.cyan,5);circ(g,x+d*.72,y+d*.84,d*.1,'none',C.cyan,5);
}
function headphones(g,x,y,d=200,col=C.purple){
 const arc=Array.from({length:23},(_,i)=>{const a=Math.PI+i*Math.PI/22;return [50+35*Math.cos(a),48+35*Math.sin(a)]});
 pathShape(g,arc,x,y,d,d,col,8);rect(g,x+d*.11,y+d*.43,d*.2,d*.4,'none',col,7,10);rect(g,x+d*.69,y+d*.43,d*.2,d*.4,'none',col,7,10);
}
function arrow(g,x1,y1,x2,y2,col=C.white){line(g,x1,y1,x2,y2,col,3);const sign=x2>x1?1:-1;pathShape(g,[[sign===1?0:100,0],[sign===1?100:0,50],[sign===1?0:100,100]],Math.min(x2-sign*14,x2),y2-10,14,20,col,3);}
function browser(g='browser',x=360,y=140,w=1200,h=700,{content=true,url='example.com',alpha=100}={}){
 const op=col=>alpha===100?col:col+'/'+alpha;
 rect(g,x,y,w,h,op(C.panel),op(C.cyan+'/45'),1.5,24);
 rect(g,x+2,y+2,w-4,70,op('#191F38'),'none',0,22);
 circ(g,x+30,y+27,14,op(C.purple));circ(g,x+57,y+27,14,op(C.cyan));
 rect(g,x+130,y+16,w-250,40,op('#0B1024'),'none',0,10);
 text(g,url,x+160,y+21,w-310,28,22,op(C.gray),false,'left');
 line(g,x,y+72,x+w,y+72,op(C.cyan+'/18'),1);
 if(content){
  rect(g,x+60,y+119,w*.41,22,op(C.gray+'/55'),'none',0,6);
  [0,1,2].forEach(i=>rect(g,x+60,y+172+34*i,w*(i===2?.37:.52),10,op(C.gray+'/25'),'none',0,5));
  rect(g,x+w*.65,y+122,w*.25,210,op(C.purple+'/10'),op(C.purple+'/20'),1,18);
  [0,1,2].forEach(i=>{rect(g,x+60+i*w*.285,y+382,w*.245,130,op('#192039'),'none',0,14);rect(g,x+82+i*w*.285,y+411,w*.15,9,op(C.gray+'/20'),'none',0,4);rect(g,x+82+i*w*.285,y+435,w*.18,9,op(C.gray+'/15'),'none',0,4);});
 }
}
function consent({mouse=true,thinking=false}={}){
 rect('consent',460,640,1000,220,C.navy,C.purple,2,24);
 text('consent','نستخدم ملفات تعريف الارتباط لتحسين تجربتك',500,666,920,66,40,C.white,false,'right');
 rect('accept',500,760,220,64,C.cyan,'none',0,12);text('accept','Accept All',500,764,220,54,28,C.black,true);
 rect('reject',760,760,180,64,'none',C.gray,1.5,12);text('reject','Reject',760,764,180,54,28,C.white);
 if(mouse)cursor('cursor',thinking?624:890,thinking?793:894,49);
 if(thinking){circ('thought',706,741,52,C.purple+'/10',C.purple,2);text('thought','?',707,740,50,49,36,C.purple,true);circ('thought',692,790,9,C.purple);circ('thought',681,806,5,C.purple);}
}
function roadmap(focus=-1,last=false){
 const xs=[130,575,1020,1465], labels=['What are\nCookies?','What do\nthey store?','Cookie\nTypes','Privacy\n& Consent'];
 line('road-line',250,540,1665,540,C.cyan+'/30',2);
 xs.forEach((x,i)=>{
 const active=i===focus||(last&&i===3),a=focus<0?40:active?100:30,scale=active?1.1:1;
 const w=325*scale,h=180*scale,xx=x-(w-325)/2, yy=450-(h-180)/2;
 rect(`road-${i}`,xx,yy,w,h,C.panel+'/'+a,C.cyan+'/'+a,active?2.5:1.5,20);
 text(`road-${i}`,labels[i],xx+20,yy+28,w-40,h-56,36,C.white+'/'+a,active);
 });
}

// Scene 1: consent and reflex click.
addSlide(1,1,3.5);browser();build('browser',0,.5,'zoom');
addSlide(1,2,4.5);browser();consent();build('consent',0,.5,'fly');build('accept',.3);build('reject',.35);build('cursor',.5,.5);
addSlide(1,3,4,'dissolve');browser();cursor('cursor',605,789,49);circ('ripple',584,770,56,'none',C.cyan,3);cookie('cookie',920,470,80);text('accept-question','Accept All?',650,874,620,98,78,C.white,true);build('ripple',0,.2);build('ripple',.3,.2,'fade',true);build('cookie',.3,.4,'zoom');build('cookie',1.15,.2,'fade',true);build('accept-question',.6);

// Scene 2: what did the click mean?
addSlide(2,1,4.5);cookie('cookie',860,340,200);[[720,350],[1120,305],[1045,580]].forEach(([x,y],i)=>{text(`question-${i}`,'?',x,y,80,96,80,C.purple,true);build(`question-${i}`,.4+.15*i)});
addSlide(2,2,5.5,'dissolve');fileIcon('data-file',860,340,200);
[[435,'معلومات عنك؟'],[960,'تفضيلاتك؟'],[1485,'تتبع نشاطك؟']].forEach(([x,t],i)=>{line(`branch-${i}`,960,540,x,700,C.cyan+'/40',2);rect(`option-${i}`,x-190,700,380,140,C.panel,C.cyan,1.5,20);text(`option-${i}`,t,x-170,739,340,64,40,C.white);build(`option-${i}`,.6+.2*i,.5,'fly');build(`branch-${i}`,.7+.2*i)});

// Scene 3: a cookie links the browser to a login session.
for(let part=1;part<=2;part++){
 addSlide(3,part,6,part===2?'dissolve':'magic move');
 [[200,C.purple,'User'],[830,C.cyan,'Browser'],[1460,C.purple,'Website Server']].forEach(([x,col,t],i)=>{rect(`node-${i}`,x,460,260,160,C.panel,col,2,18);text(`node-${i}`,t,x+10,500,240,52,i===2?31:37,C.white,true);});
 userIcon('user-icon',274,308,112);browserIcon('browser-icon',904,315,112);serverIcon('server-icon',1534,295,112);
 arrow('request-user',480,540,803,540);arrow('request-server',1110,540,1430,540);
 if(part===1){['node-0','user-icon','node-1','browser-icon','node-2','server-icon','request-user','request-server'].forEach((g,i)=>build(g,Math.floor(i/2)*.2));}
 else{arrow('return',1430,720,1090,720,C.amber);cookie('session-cookie',991,680,80);text('logged-in','Logged In',850,560,220,42,28,C.mint,true);build('session-cookie',0,.5,'fly');build('logged-in',.4);}
}

// Scene 4: a remembered cart.
addSlide(4,1,3.2);browser('browser',360,140,1200,700,{content:false,url:'shop.example'});cart('cart',822,340,276);build('cart',0,.5,'zoom');
addSlide(4,2,2.3,'dissolve');clock('clock',895,450,130);build('clock',.2);build('clock',1.4,.4,'fade',true);
addSlide(4,3,4.5,'dissolve');browser('browser',360,140,1200,700,{content:false,url:'shop.example'});cart('cart',822,320,276);cookie('cart-cookie',1135,390,80);text('cart-caption','Your cart is still here',560,686,800,75,52,C.white,true);build('cart',.2);build('cart-cookie',.4);build('cart-caption',.5);

// Scene 5: product search and later ads.
addSlide(5,1,3);browser('search-browser',460,265,1000,500,{content:false,url:'search.example'});rect('search-field',570,382,780,70,'#0A1024',C.cyan+'/30',1,15);text('search-field','Headphones',614,392,675,50,32,C.white,false,'left');headphones('headphones',850,494,200);build('search-browser',0,.5,'zoom');build('search-field',.2);build('headphones',.35);
for(let part=2;part<=3;part++){
 addSlide(5,part,part===2?3.2:3.8,part===3?'dissolve':'magic move');
 browser('search-browser',180,260,740,500,{content:false,url:'search.example'});browser('second-browser',1000,260,740,500,{content:false,url:'daily.example'});
 rect('search-field',235,378,630,66,'#0A1024',C.cyan+'/30',1,12);text('search-field','Headphones',270,386,550,48,30,C.white,false,'left');headphones('headphones',458,495,184);
 rect('ad',1090,395,560,287,C.coral+'/5',C.coral,2,18);text('ad','Ad',1114,410,60,32,24,C.coral,false,'left');headphones('ad',1273,433,174,C.purple);text('ad','Headphones',1160,621,420,44,31,C.white,true);
 if(part===2){build('second-browser',0,.5,'fly');build('ad',.4,.4,'zoom');}
 if(part===3){line('tracking-link',815,815,1105,815,C.coral,3,true);line('tracking-link',815,770,815,815,C.coral,3,true);line('tracking-link',1105,770,1105,815,C.coral,3,true);text('tracking-title','Tracking Cookies?',580,120,760,78,55,C.coral,true);build('tracking-link',0);build('tracking-title',.3);}
}

// Scene 6: two different uses.
for(let part=1;part<=2;part++){
 addSlide(6,part,part===1?4.5:7.5,part===2?'dissolve':'magic move');
 line('divider',960,95,960,1000,C.cyan+'/30',2);
 text('useful-title','Useful',225,142,490,83,62,C.mint,true);text('tracking-title','Tracking',1205,142,490,83,62,C.coral,true);
 cookie('cookie',860,380,200);
 if(part===1){build('divider',0);build('useful-title',.1);build('tracking-title',.1);build('cookie',.3,.5,'zoom');}
 else{
  ['Login','Language','Shopping Cart'].forEach((t,i)=>{rect(`use-${i}`,250,475+i*139,440,94,C.panel,C.mint,1.5,16);text(`use-${i}`,t,275,490+i*139,390,60,36,C.white);build(`use-${i}`,.15*i,.5,'fly')});
  ['Interests','Ads','Activity'].forEach((t,i)=>{rect(`track-${i}`,1230,475+i*139,440,94,C.panel,C.coral,1.5,16);text(`track-${i}`,t,1255,490+i*139,390,60,36,C.white);build(`track-${i}`,.15*i,.5,'fly')});
 }
}

// Scene 7: four topics, with the last two sharing one slide as requested.
addSlide(7,1,1);roadmap(-1);
addSlide(7,2,2.5);roadmap(0);
addSlide(7,3,2.5);roadmap(1);
addSlide(7,4,4,'dissolve');roadmap(2,true);build('road-3',1.7,.4,'zoom');

// Scene 8: editable simulated browser developer tools.
for(let part=1;part<=2;part++){
 addSlide(8,part,6,part===2?'dissolve':'magic move');
 rect('devtools',260,160,1400,760,'#0D1224',C.cyan,1.5,24);
 text('devtools','Elements',305,184,165,45,29,C.gray);text('devtools','Console',510,184,145,45,29,C.gray);text('devtools','Application / Storage',700,184,370,45,30,C.cyan,true);
 line('devtools',700,243,1070,243,C.cyan,4);line('devtools',260,245,1660,245,C.cyan+'/20',1);
 text('cookie-table','Cookies',304,267,300,43,28,C.gray,false,'left');
 rect('cookie-table',300,326,1320,66,C.panel,'none',0,8);
 [['Name',320,350],['Value',705,250],['Domain',1060,490]].forEach(([t,x,w])=>text('cookie-table',t,x,336,w,43,28,C.gray,false,'left'));
 rect('cookie-row',300,398,1320,65,C.cyan+'/8','none',0,8);
 [['username',320,350],['Abdo',705,250],['localhost',1060,490]].forEach(([t,x,w])=>text('cookie-row',t,x,407,w,45,29,C.white,false,'left',F.mono));
 if(part===1){build('devtools',0,.5,'zoom');build('cookie-table',.3);build('cookie-row',.4);}
 else{
  rect('code',300,527,1320,174,'#000000',C.purple,1.5,16);
  text('code','document.cookie',348,581,470,62,38,C.cyan,false,'left',F.mono);
  text('code','= "username=Abdo";',804,581,770,62,38,C.white,false,'left',F.mono);
  ['Create','Read','Delete'].forEach((t,i)=>{text(`action-${i}`,t,330+435*i,771,360,66,43,C.amber,true);build(`action-${i}`,.5+.25*i)});build('code',0,.5,'fly');
 }
}

// Scene 9: the choice revisited, then title.
addSlide(9,1,4.2);browser();consent({thinking:true});build('thought',.6);
addSlide(9,2,1.8,'dissolve');browser('browser',696,374,528,308,{content:false,url:'example.com'});cookie('cookie',900,461,120);userIcon('user',676,409,70);cart('cart',1140,431,85);fileIcon('file',930,652,70);build('browser',.6,.4,'fade',true);build('cookie',.6,.4,'fade',true);build('user',.6,.4,'fade',true);build('cart',.6,.4,'fade',true);build('file',.6,.4,'fade',true);
addSlide(9,3,4,'dissolve');text('final-title','يعني إيه Cookies؟',360,417,1200,150,108,C.white,true);text('final-subtitle','How Websites Remember You',410,583,1100,70,43,C.cyan);build('final-title',.2,.5,'zoom');build('final-subtitle',.5);

if(meta.length!==24||Math.abs(meta.reduce((a,m)=>a+m.duration,0)-98)>.001)throw new Error('Scene count or duration mismatch');
await fs.writeFile(path.join(TMP,'metadata.json'),JSON.stringify(meta,null,2));
await fs.writeFile(path.join(TMP,'presentation.json'),JSON.stringify(p.toProto()));
await (await PresentationFile.exportPptx(p)).save(path.join(TMP,'raw.pptx'));
await fs.mkdir(path.join(TMP,'renders'),{recursive:true});
for(let i=0;i<p.slides.items.length;i++){
 const s=p.slides.items[i];
 const png=await p.export({slide:s,format:'png',scale:.6});
 await fs.writeFile(path.join(TMP,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 const layout=await s.export({format:'layout'});
 await fs.writeFile(path.join(TMP,'renders',`slide-${String(i+1).padStart(2,'0')}.json`),await layout.text());
 console.log(`Rendered ${i+1}/24`);
}
console.log(`Authored ${meta.length} slides, 98 seconds`);
