import fs from 'node:fs/promises';
import path from 'node:path';
import {PresentationFile} from '@oai/artifact-tool';
import {p,meta,addSlide,rect,circ,text,line,pathShape,cookie,userIcon,browserIcon,serverIcon,arrow,C,F} from '../../cookies-intro/.build/components.mjs';
const TMP=import.meta.dirname;
let s;
function stage(clip,n,seconds,note,trans=.4){
 s=addSlide(clip,n,seconds);const m=meta.at(-1);
 m.id=`${['','A','B','C'][clip]}${String(n).padStart(2,'0')}`;m.opacity={};m.scale={};m.trans=trans;
 m.glowGroups=[];m.clip=clip;
 s.speakerNotes.textFrame.setText(`${m.id} — ${['','إزاي الموقع بيفتكرك؟','أنواع الـCookies','Cookies vs Cache vs Local Storage'][clip]}\nمدة المرحلة: ${seconds} ثانية.\n\n${note}\n\nالانتقال اليدوي المقترح في Keynote: Magic Move، مدة ${trans} ثانية، Ease Out.\nالفترات محسوبة لكل مقطع على حدة.\nجميع العناصر أشكال ونصوص قابلة للتعديل. لا يوجد صوت.`);
 return s;
}
function card(g,x,y,w,h,accent=C.cyan){
 let sh=rect(g,x,y,w,h,C.panel,C.cyan+'/60',2,28);sh.shadow='0px 8px 24px #000000/35';meta.at(-1).glowGroups.push(g);return sh;
}
function fade(g,value){meta.at(-1).opacity[g]=value;}
function scale(g,value){meta.at(-1).scale[g]=value;}
function check(g,x,y,d,col=C.mint){circ(g,x,y,d,col);pathShape(g,[[25,51],[43,70],[77,31]],x,y,d,d,C.white,7);}
function arrow2(g,x1,y1,x2,y2,col,lw=5){arrow(g,x1,y1,x2,y2,col);line(g,x1,y1,x2,y2,col,lw);}
function headingA(){text('main-heading','إزاي الموقع بيفتكرك؟',610,55,700,75,48,C.white,true);}
function relationship({verified=false,saved=false,recognized=false,requests=false}={}){
 headingA();
 card('user',120,360,330,300);text('user','User',140,378,290,54,42,C.white,true);userIcon('user',233,443,104,C.purple);text('user','المستخدم',140,580,290,50,31,C.gray);
 card('browser',795,330,330,360);text('browser','Browser',815,350,290,54,42,C.white,true);browserIcon('browser',902,416,116,C.cyan);text('browser','المتصفح',815,saved?628:565,290,45,31,C.gray);
 card('server',1470,360,330,300);text('server','Server',1490,378,290,54,42,C.white,true);
 if(verified||recognized){check('server-check',1580,455,110);text('server',recognized?'User Recognized':'Verified',1490,585,290,45,28,C.mint);}
 else{serverIcon('server',1584,446,106,C.mint);text('server','السيرفر',1490,580,290,50,31,C.gray);}
 if(requests){arrow2('login-arrow',450,510,795,510,C.purple);text('login-arrow','Login',522,447,200,47,29,C.purple);arrow2('request-arrow',1125,510,1470,510,C.cyan);text('request-arrow','Request',1195,447,220,47,29,C.cyan);}
 if(saved){rect('session-tag',845,515,230,90,C.amber+'/15',C.amber,2,18);text('session-tag','session_id',855,533,210,53,26,C.amber,false,'center',F.mono);rect('saved-badge',840,720,240,55,C.mint,'none',0,15);text('saved-badge','Cookie Saved',847,724,226,46,24,C.navy,true);}
}
function returnCookie(x){arrow2('return-arrow',1470,585,1125,585,C.amber,6);cookie('moving-cookie',x-45,540,90);text('return-label','Session Cookie',1210,645,280,50,28,C.amber);}
function nextRequest(x){arrow2('cookie-request',1125,570,1470,570,C.amber,6);cookie('moving-cookie',x-31,539,62);text('cookie-request','Request + Cookie',1160,610,330,50,25,C.amber);}

stage(1,1,2,'عنوان المقطع. Fade In للعنوان 0.4s وللعنوان الفرعي 0.4s بعد 0.2s.');
text('main-heading','إزاي الموقع بيفتكرك؟',460,410,1000,120,78,C.white,true);text('subtitle','How Cookies Work',660,545,600,60,34,C.cyan);
stage(1,2,2,'تصغير العنوان ونقله للأعلى. ظهور User ثم Browser ثم Server. Scale Up لكل بطاقة 0.4s، بفاصل 0.2s.');relationship();
stage(1,3,2.3,'Login: Line Draw مدة 0.4s. Request: Line Draw مدة 0.4s بعد الخط الأول.');relationship({requests:true});
stage(1,4,1.7,'التركيز على Server. علامة التحقق Scale Up مدة 0.35s. User وBrowser بعتامة 45%.');relationship({requests:true,verified:true});fade('user',.45);fade('browser',.45);fade('login-arrow',.45);fade('request-arrow',.45);
stage(1,5,1.2,'إرجاع البطاقات لعتامة 100%. بدء Cookie من السيرفر. Line Draw للسهم الذهبي 0.5s.');relationship({requests:true});returnCookie(1460);fade('request-arrow',.3);
stage(1,6,1.5,'Cookie في منتصف مسار العودة. Magic Move 0.7s بين موضعي السيرفر والمتصفح.');relationship({requests:true});returnCookie(1300);fade('request-arrow',.3);meta.at(-1).trans=.7;
stage(1,7,2,'حفظ session_id داخل المتصفح. Cookie Saved: Scale Up مدة 0.4s. User وServer بعتامة 35%.');relationship({saved:true});fade('user',.35);fade('server',.35);
stage(1,8,1.7,'إعادة العتامة 100%. Request + Cookie باتجاه السيرفر، حركة 0.7s.');relationship({saved:true});nextRequest(1158);meta.at(-1).trans=.7;
stage(1,9,1.6,'وصول Cookie للسيرفر. User Recognized: Fade In مدة 0.4s.');relationship({saved:true,recognized:true});nextRequest(1430);
stage(1,10,4,'التركيز النهائي على حالة Logged In. Magic Move / Zoom مدة 0.5s. عند نهاية المقطع: Dissolve 0.4s.');
headingA();let logged=rect('browser',560,325,800,370,C.panel,C.mint,3,36);logged.shadow='0px 8px 24px #000000/35';meta.at(-1).glowGroups.push('browser');check('success',875,380,170);text('logged-in','Logged In',660,561,600,70,58,C.white,true);text('logged-caption','الموقع افتكرك من غير ما تسجل دخول تاني',530,701,860,65,32,C.gray);meta.at(-1).trans=.5;

function clockIcon(g,x,y,d,col){circ(g,x,y,d,'none',col,5);pathShape(g,[[50,19],[50,52],[70,62]],x,y,d,d,col,5);}
function calendar(g,x,y,d,col){rect(g,x,y+10,d,d*.87,'none',col,5,12);line(g,x,y+d*.35,x+d,y+d*.35,col,4);[.25,.75].forEach(a=>line(g,x+d*a,y,x+d*a,y+d*.2,col,5));[.25,.5,.75].forEach(a=>[.5,.72].forEach(b=>circ(g,x+d*a-3,y+d*b,7,col)));}
function network(g,x,y,d,col){[[.5,.2],[.17,.75],[.83,.75]].forEach(([a,b],i,all)=>{if(i>0)line(g,x+d*.5,y+d*.2,x+d*a,y+d*b,col,4)});line(g,x+d*.17,y+d*.75,x+d*.83,y+d*.75,col,4);[[.5,.2],[.17,.75],[.83,.75]].forEach(([a,b])=>circ(g,x+d*a-13,y+d*b-13,26,C.panel,col,4));}
const types=[
 {x:250,y:360,col:C.cyan,en:'Session Cookies',ar:'مؤقتة ومرتبطة بالجلسة',icon:clockIcon},
 {x:1020,y:360,col:C.purple,en:'Persistent Cookies',ar:'لها مدة صلاحية محددة',icon:calendar},
 {x:250,y:680,col:C.mint,en:'First-Party Cookies',ar:'من الموقع اللي إنت فاتحه',icon:browserIcon},
 {x:1020,y:680,col:C.coral,en:'Third-Party Cookies',ar:'من خدمة أو جهة أخرى',icon:network},
];
function typeScene(count=4,focus=-1){
 text('types-heading','أنواع الـCookies',560,130,800,100,72,C.white,true);text('types-subheading','مش كل الـCookies زي بعضها',610,245,700,60,34,C.gray);
 types.slice(0,count).forEach((t,i)=>{const g=`type-${i}`;card(g,t.x,t.y,650,230,t.col);t.icon(g,t.x+46,t.y+70,95,t.col);text(g,t.en,t.x+175,t.y+45,435,65,39,t.col,true);text(g,t.ar,t.x+173,t.y+125,439,58,32,C.white);if(focus>=0){if(i===focus)scale(g,1.05);else fade(g,.3);}});
}
stage(2,1,1.6,'عنوان المقطع. Fade In مدة 0.4s.');typeScene(0);
for(let n=1;n<=4;n++){stage(2,n+1,n===4?.9:.5,`ظهور بطاقة ${types[n-1].en}. Sequential Reveal، فرق التوقيت 0.2s، الحركة 0.4s.`);typeScene(n);}
for(let f=0;f<4;f++){stage(2,f+6,3,`التركيز على ${types[f].en}: Scale 105%، بقية البطاقات 30%. Magic Move 0.4s.`);typeScene(4,f);}
stage(2,10,1,'عودة البطاقات الأربع إلى الحجم والعتامة الأصليين. Magic Move 0.4s.');typeScene();

function lightning(g,x,y,d,col){pathShape(g,[[55,3],[17,55],[46,55],[34,97],[86,39],[58,39]],x,y,d,d,'none',0,col,true);}
function database(g,x,y,d,col){rect(g,x+7,y+13,d-14,d*.7,'none',col,5,9);shEllipse(g,x+7,y+2,d-14,d*.28,C.panel,col,5);shEllipse(g,x+7,y+d*.61,d-14,d*.28,'none',col,5);}
function shEllipse(g,x,y,w,h,fill,col,lw){const q=s.shapes.add({name:`${g}/ellipse-${x}-${y}`,geometry:'ellipse',position:{left:x,top:y,width:w,height:h},fill,line:{fill:col,width:lw}});return q;}
const comparisons=[
 {x:120,col:C.amber,en:'Cookies',ar:['بيانات صغيرة','تساعد في الجلسات والتفضيلات','قد تُرسل مع طلبات الموقع'],icon:cookie},
 {x:710,col:C.cyan,en:'Cache',ar:['يخزن صور وملفات الموقع','هدفه الأساسي السرعة','يقلل إعادة التحميل'],icon:lightning},
 {x:1300,col:C.purple,en:'Local Storage',ar:['تخزين محلي داخل المتصفح','مساحة أكبر نسبيًا','لا يُرسل تلقائيًا مع كل Request'],icon:database},
];
function comparisonScene(count=3,focus=-1,summary=false){
 text('compare-heading','إيه الفرق بينهم؟',560,90,800,95,68,C.white,true);text('compare-subtitle','Cookies vs Cache vs Local Storage',535,200,850,55,34,C.cyan);
 comparisons.slice(0,count).forEach((a,i)=>{const g=`comparison-${i}`;card(g,a.x,360,500,470,a.col);a.icon(g,a.x+190,398,120,a.col);text(g,a.en,a.x+32,549,436,66,47,a.col,true);a.ar.forEach((t,j)=>text(g,t,a.x+30,640+j*51,440,44,29,C.white));if(focus>=0){if(i===focus)scale(g,1.06);else fade(g,.3);}});
 if(summary){rect('summary',310,900,1300,90,C.panel,C.cyan+'/40',2,24);text('summary','Cookies للجلسة • Cache للسرعة • Local Storage للتخزين المحلي',340,917,1240,56,32,C.white);}
}
stage(3,1,1.6,'عنوان المقارنة. Fade In مدة 0.4s.');comparisonScene(0);
for(let n=1;n<=3;n++){stage(3,n+1,.6,`ظهور بطاقة ${comparisons[n-1].en} من الأسفل 0.4s، بفاصل 0.2s.`);comparisonScene(n);}
for(let f=0;f<3;f++){stage(3,f+5,4,`التركيز على ${comparisons[f].en}: Scale 106% وGlow بلون البطاقة. بقية البطاقات 30%. Magic Move 0.4s.`);comparisonScene(3,f);}
stage(3,8,2.6,'عودة البطاقات الثلاث إلى حالتها الطبيعية. الشريط الختامي: Fade In مدة 0.4s.');comparisonScene(3,-1,true);

await fs.writeFile(path.join(TMP,'metadata.json'),JSON.stringify(meta,null,2));
await fs.writeFile(path.join(TMP,'presentation.json'),JSON.stringify(p.toProto()));
await (await PresentationFile.exportPptx(p)).save(path.join(TMP,'raw.pptx'));
console.log(JSON.stringify({slides:meta.length,clipDurations:[1,2,3].map(c=>meta.filter(m=>m.clip===c).reduce((a,m)=>a+m.duration,0))}));
