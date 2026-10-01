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


export {p,meta,addSlide,build,sh,rect,circ,text,line,pathShape,cookie,fileIcon,cursor,clock,userIcon,browserIcon,serverIcon,cart,headphones,arrow,C,F};
