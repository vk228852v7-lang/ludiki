/* LUDIKI — серия 2 «Экспресс». three.js r128, всё рисуется кодом, звук — Web Audio. */
(function(){
try{
'use strict';
const $=id=>document.getElementById(id);
const stage=$('stage'), canvas=$('scene'), posterEl=$('poster'), startBtn=$('start'), startLabel=$('startLabel'), posterEp=$('posterEp');
const playBtn=$('play'), playIcon=$('playIcon'), timeEl=$('time'), scrub=$('scrub'), soundBtn=$('sound'), soundIcon=$('soundIcon'), fsBtn=$('fs'), playerEl=$('player');
const ovTitle=$('ovTitle'), ovIris=$('ovIris'), ovEnd=$('ovEnd');
const DUR=34, POSTER_T=25.4;
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function fail(msg){ const d=document.createElement('div'); d.className='fail'; d.textContent=msg; stage.appendChild(d); posterEl.hidden=true; }
if(!window.THREE){ fail('Не удалось загрузить three.js. Обновите страницу.'); return; }
let renderer;
try{ try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true}); }catch(e0){ renderer=new THREE.WebGLRenderer({canvas,antialias:false}); } }catch(e){ fail('Браузер не смог запустить 3D-графику (WebGL). Откройте страницу в другом браузере.'); return; }

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:(x>b?b:x);
const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const lerp=(a,b,k)=>a+(b-a)*k;
const bump=(t,a,b)=>(t>a&&t<b)?Math.sin(Math.PI*(t-a)/(b-a)):0;
const win=(t,a,b,fi,fo)=>sm(seg(t,a,a+fi))*(1-sm(seg(t,b-fo,b)));
const back=x=>{ x=clamp(x,0,1); const c=2.2; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); };
const elastic=x=>{ x=clamp(x,0,1); if(x===0||x===1) return x; return Math.pow(2,-10*x)*Math.sin((x*10-0.75)*TAU/3)+1; };
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const midi=m=>440*Math.pow(2,(m-69)/12);
const BEAT=0.375; // 160 BPM

/* ---------- scene ---------- */
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xFFFFFF);
const camera=new THREE.PerspectiveCamera(40,16/9,0.03,200);
function canvasTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); return new THREE.CanvasTexture(c); }
const grad=canvasTex(3,1,g=>{ ['#7a7a7a','#c4c4c4','#ffffff'].forEach((c,i)=>{g.fillStyle=c; g.fillRect(i,0,1,1);}); });
grad.minFilter=grad.magFilter=THREE.NearestFilter; grad.generateMipmaps=false;
const toon=(color,extra)=>new THREE.MeshToonMaterial(Object.assign({color,gradientMap:grad},extra||{}));
const basic=(color,extra)=>new THREE.MeshBasicMaterial(Object.assign({color},extra||{}));
const OUT=new THREE.MeshBasicMaterial({color:0x221C24,side:THREE.BackSide});
const GEO={ sph:new THREE.SphereGeometry(1,28,18), sphLo:new THREE.SphereGeometry(1,14,10), cyl:new THREE.CylinderGeometry(1,1,1,18), box:new THREE.BoxGeometry(1,1,1), disc:new THREE.CircleGeometry(1,28), half:new THREE.CircleGeometry(1,24,Math.PI,Math.PI) };
function addOutline(mesh,s){ const o=new THREE.Mesh(mesh.geometry,OUT); o.scale.setScalar(s); mesh.add(o); return o; }
function part(geo,mat,parent,o){
  o=o||{}; const m=new THREE.Mesh(geo,mat);
  if(o.p) m.position.set(o.p[0],o.p[1],o.p[2]);
  if(o.r) m.rotation.set(o.r[0],o.r[1],o.r[2]);
  if(o.s!==undefined){ if(typeof o.s==='number') m.scale.setScalar(o.s); else m.scale.set(o.s[0],o.s[1],o.s[2]); }
  m.castShadow=o.cast!==false; m.receiveShadow=!!o.recv;
  const ol=o.o===undefined?1.07:o.o; if(ol) addOutline(m,ol);
  parent.add(m); return m;
}
function group(parent,p){ const g=new THREE.Group(); if(p) g.position.set(p[0],p[1],p[2]); parent.add(g); return g; }
const WHITE=basic(0xFFFFFF), INK=basic(0x150F12), MOUTHC=basic(0x4A141B), TONGUE=basic(0xE2646E), BLUSH=basic(0xFF8C8C,{transparent:true,opacity:0.55});

scene.add(new THREE.HemisphereLight(0xFFFFFF,0xF2EEE6,0.62));
const key=new THREE.DirectionalLight(0xFFFFFF,0.55);
key.position.set(4,12,10); key.target.position.set(0,1,-1);
key.castShadow=true; key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:50});
key.shadow.bias=-0.0006; key.shadow.normalBias=0.02;
scene.add(key,key.target);
const glow=new THREE.PointLight(0xCFEFFF,0,2.2,2); scene.add(glow);

/* ---------- characters (same three kids, bigger expressive faces) ---------- */
function curls(head,mat,mat2,center,rad,rows,cr){
  rows.forEach(([e,a0,a1,n],ri)=>{ for(let i=0;i<n;i++){ const a=n===1?0:lerp(a0,a1,i/(n-1)); const d=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
    part(GEO.sphLo,(i+ri)%2?mat2:mat,head,{p:[center[0]+d[0]*rad,center[1]+d[1]*rad,center[2]+d[2]*rad],s:cr*(0.9+((i*7+ri*3)%5)*0.05),o:1.1}); } });
}
function makeKid(c){
  const R={c}; R.root=group(scene); R.base=c.scale||1; R.root.scale.setScalar(R.base);
  const skin=toon(c.skin), top=toon(c.top), pants=toon(c.pants), shoe=toon(c.shoe), brow=basic(c.brow);
  R.hipsY=0.82; R.hips=group(R.root,[0,R.hipsY,0]);
  part(GEO.sph,top,R.hips,{p:[0,0.42,0],s:[0.47,0.56,0.36]});
  part(GEO.cyl,skin,R.hips,{p:[0,0.98,0],s:[0.13,0.18,0.13],o:0});
  R.head=group(R.hips,[0,1.42,0]); R.head.scale.setScalar(1.08);
  part(GEO.sph,skin,R.head,{s:[0.58,0.6,0.56]});
  for(const sx of [-1,1]){
    part(GEO.sph,skin,R.head,{p:[0.56*sx,-0.02,0.02],s:[0.09,0.13,0.07],o:1.12});
    part(GEO.sph,BLUSH,R.head,{p:[0.33*sx,-0.13,0.44],s:[0.1,0.055,0.04],r:[0,0.55*sx,0],o:0,cast:false});
  }
  part(GEO.sph,toon(c.skinDark),R.head,{p:[0,-0.07,0.56],s:[0.06,0.07,0.055],o:1.12});
  // eyes: white sclera with outline, coloured iris, pupil, two highlights
  const IRIS=basic(c.iris);
  R.eyes=[]; R.irises=[]; R.lids=[];
  for(const sx of [-1,1]){
    const e=group(R.head,[0.19*sx,0.05,0.505]); e.rotation.y=0.3*sx;
    part(GEO.sph,WHITE,e,{s:[0.105,0.13,0.04],o:1.16,cast:false});
    const ir=group(e,[0,-0.01,0.041]);
    part(GEO.disc,IRIS,ir,{s:[0.064,0.078,1],o:0,cast:false});
    part(GEO.disc,INK,ir,{p:[0,0,0.002],s:[0.036,0.045,1],o:0,cast:false});
    part(GEO.disc,WHITE,ir,{p:[0.022,0.028,0.004],s:0.017,o:0,cast:false});
    part(GEO.disc,WHITE,ir,{p:[-0.02,-0.025,0.004],s:0.008,o:0,cast:false});
    R.eyes.push(e); R.irises.push(ir);
    if(c.lids){ const l=part(GEO.sph,skin,e,{p:[0,0.072,0.004],s:[0.12,0.078,0.085],o:0,cast:false}); R.lids.push(l); }
  }
  R.brows=[];
  for(const sx of [-1,1]){ const b=group(R.head,[0.19*sx,0.215,0.5]); b.rotation.y=0.3*sx; part(GEO.box,brow,b,{s:[0.18,c.browT,0.03],o:0,cast:false}); R.brows.push(b); }
  // mouths
  R.mouths={};
  R.mouths.flat=part(GEO.box,MOUTHC,R.head,{p:[0,-0.26,0.51],s:[0.14,0.024,0.02],o:0,cast:false});
  const arcGeo=(len)=>new THREE.TorusGeometry(0.11,0.022,6,18,len);
  R.mouths.smile=part(arcGeo(Math.PI),MOUTHC,R.head,{p:[0,-0.19,0.525],r:[0,0,Math.PI],o:0,cast:false});
  R.mouths.smirk=part(arcGeo(Math.PI*0.7),MOUTHC,R.head,{p:[0.03,-0.2,0.525],r:[0,0,Math.PI+0.35],o:0,cast:false});
  const op=group(R.head,[0,-0.27,0.518]); op.rotation.x=0.3;
  part(GEO.disc,MOUTHC,op,{s:[0.075,0.092,1],o:0,cast:false}); part(GEO.disc,TONGUE,op,{p:[0,-0.05,0.002],s:[0.05,0.03,1],o:0,cast:false});
  R.mouths.open=op;
  const gr=group(R.head,[0,-0.19,0.546]); gr.rotation.x=0.38;
  part(GEO.half,MOUTHC,gr,{s:[0.15,0.15,1],o:0,cast:false});
  part(GEO.box,WHITE,gr,{p:[0,-0.022,0.002],s:[0.21,0.04,0.004],o:0,cast:false});
  part(GEO.disc,TONGUE,gr,{p:[0,-0.11,0.003],s:[0.07,0.035,1],o:0,cast:false});
  R.mouths.grin=gr;
  R.setMouth=k=>{ for(const m in R.mouths) R.mouths[m].visible=(m===k); };
  R.setMouth(c.mouth);
  R.armA=group(R.hips,[0.5,0.74,0]); R.armB=group(R.hips,[-0.5,0.74,0]);
  for(const a of [R.armA,R.armB]){
    if(c.shortSleeve){ part(GEO.sph,top,a,{p:[0,-0.15,0],s:[0.16,0.22,0.16]}); part(GEO.sph,skin,a,{p:[0,-0.42,0],s:[0.11,0.26,0.11]}); }
    else part(GEO.sph,top,a,{p:[0,-0.3,0],s:[0.14,0.36,0.14]});
    part(GEO.sph,skin,a,{p:[0,-0.64,0.02],s:0.12});
  }
  R.handA=group(R.armA,[0,-0.68,0.05]); R.handB=group(R.armB,[0,-0.68,0.05]);
  R.legY=0.82; R.legA=group(R.root,[0.2,R.legY,0]); R.legB=group(R.root,[-0.2,R.legY,0]);
  for(const l of [R.legA,R.legB]){ part(GEO.sph,pants,l,{p:[0,-0.36,0],s:[0.17,0.4,0.17]}); part(GEO.sph,shoe,l,{p:[0,-0.74,0.08],s:[0.16,0.1,0.26]}); }
  c.build(R,{skin,top});
  return R;
}
// A: dark straight hair with a side-swept fringe, black jacket over a white tee, earbud
const KA=makeKid({skin:0xF1CBAA,skinDark:0xE2AE8C,top:0x262A31,pants:0x30394A,shoe:0xF4F4F4,brow:0x3A2619,browT:0.03,browTilt:0.05,iris:0x4A2E1C,mouth:'flat',lids:true,
  build(R,m){ const h=toon(0x3A2619), h2=toon(0x4B3222), H=R.head;
    part(GEO.sph,h,H,{p:[0,0.22,-0.1],s:[0.62,0.56,0.58]});
    part(GEO.sph,h,H,{p:[0,-0.04,-0.36],s:[0.52,0.44,0.3]});
    for(const sx of [-1,1]) part(GEO.sph,h,H,{p:[0.52*sx,0.12,0.0],s:[0.14,0.3,0.32]});
    part(GEO.sph,h,H,{p:[0.04,0.4,0.38],s:[0.5,0.15,0.2],r:[0.25,0,-0.24]});
    part(GEO.sph,h2,H,{p:[0.34,0.3,0.4],s:[0.22,0.15,0.16],r:[0.2,0,-0.65]});
    part(GEO.sph,h2,H,{p:[-0.3,0.44,0.3],s:[0.26,0.13,0.2],r:[0.3,0,0.2]});
    const bud=basic(0xFAFAFA); part(GEO.sph,bud,H,{p:[0.6,-0.05,0.08],s:[0.045,0.06,0.045],o:1.2}); part(GEO.cyl,bud,H,{p:[0.6,-0.15,0.09],s:[0.018,0.13,0.018],o:1.3});
    part(GEO.sph,toon(0xF4F4F1),R.hips,{p:[0,0.46,0.22],s:[0.22,0.44,0.16],o:0});
    for(const sx of [-1,1]){ part(GEO.box,m.top,R.hips,{p:[0.17*sx,0.62,0.31],s:[0.09,0.42,0.06],r:[0,0,-0.18*sx],o:1.1}); part(GEO.box,m.top,R.hips,{p:[0.2*sx,0.92,0.14],s:[0.2,0.1,0.14],r:[0.5,0,-0.4*sx],o:1.1}); }
  }});
// B: light brown curls, white long-sleeve, black trousers, crossbody strap
const KB=makeKid({skin:0xEFC4A1,skinDark:0xDDA885,top:0xF6F5F1,pants:0x1D1E23,shoe:0xF2F2F2,brow:0x6E4B30,browT:0.04,browTilt:-0.08,iris:0x7A5230,mouth:'smile',scale:1.06,
  build(R){ const h=toon(0xA0724A), h2=toon(0xC59565), side=toon(0x7E583A), H=R.head;
    part(GEO.sph,side,H,{p:[0,0.18,-0.08],s:[0.61,0.56,0.58]});
    curls(H,h,h2,[0,0.14,0],0.56,[[0.4,-0.9,0.9,7],[0.66,-1.5,1.5,9],[0.94,-2.5,2.5,9],[1.28,-2.6,2.6,6]],0.15);
    const blk=toon(0x18181B);
    part(GEO.box,blk,R.hips,{p:[0.0,0.48,0.345],s:[0.07,1.0,0.03],r:[0.12,0,0.62],o:0});
    part(GEO.box,blk,R.hips,{p:[0.0,0.48,-0.345],s:[0.07,1.0,0.03],r:[-0.12,0,-0.62],o:0});
    part(GEO.box,blk,R.hips,{p:[-0.42,0.12,0.12],s:[0.12,0.26,0.24]});
  }});
// C: dark wavy curls, thick brows, burgundy polo
const KC=makeKid({skin:0xEAB896,skinDark:0xD69C78,top:0x7B1F2E,pants:0x3A3D44,shoe:0xF0F0F0,brow:0x1A120E,browT:0.062,browTilt:0.12,iris:0x3A2416,mouth:'smirk',shortSleeve:true,
  build(R,m){ const h=toon(0x1E1612), h2=toon(0x2E221C), H=R.head;
    part(GEO.sph,h,H,{p:[0,0.22,-0.08],s:[0.65,0.6,0.62]});
    part(GEO.sph,h,H,{p:[0,-0.02,-0.36],s:[0.54,0.44,0.32]});
    curls(H,h,h2,[0,0.14,0],0.58,[[0.1,-1.5,-1.25,2],[0.1,1.25,1.5,2],[0.42,-1.0,1.0,6],[0.7,-1.6,1.6,8],[0.98,-2.6,2.6,8],[1.32,-2.4,2.4,5]],0.19);
    part(GEO.sphLo,h2,H,{p:[-0.1,0.37,0.48],s:0.12,o:1.1}); part(GEO.sphLo,h,H,{p:[0.16,0.38,0.47],s:0.11,o:1.1});
    const dk=toon(0x641826);
    for(const sx of [-1,1]) part(GEO.box,dk,R.hips,{p:[0.14*sx,0.93,0.2],s:[0.2,0.07,0.17],r:[0.45,0,-0.5*sx],o:1.12});
    part(GEO.box,dk,R.hips,{p:[0,0.78,0.335],s:[0.07,0.22,0.03],o:0});
    [0.84,0.72].forEach(y=>part(GEO.sphLo,toon(0xF2E9E4),R.hips,{p:[0,y,0.355],s:0.02,o:0}));
  }});
const KIDS=[KA,KB,KC];

/* face controls */
function face(R,o){
  const es=o.eye===undefined?1:o.eye, sq=o.squint||0;
  R.eyes.forEach(e=>{ e.scale.set(es,es*(1-0.72*sq),es); });
  R.irises.forEach(ir=>{ ir.position.x=0.034*(o.lx||0); ir.position.y=-0.01+0.04*(o.ly||0); });
  R.lids.forEach(l=>{ l.visible=!o.noLid; });
  R.brows.forEach((b,i)=>{ const sx=i?1:-1; b.position.y=0.215+0.07*(o.brow||0)/R.head.scale.y*(1); b.rotation.z=(R.c.browTilt+(o.browTilt||0))*sx*-1; });
  if(o.mouth) R.setMouth(o.mouth);
  const ms=o.mouthS===undefined?1:o.mouthS; R.mouths.open.scale.set(1,ms,1); R.mouths.grin.scale.set(1,ms,1);
}
function blinkK(R,t,off){ const c=(t+off)%3.3; if(c<0.12) R.eyes.forEach(e=>e.scale.y*=0.1); }

/* ---------- intro set: sunburst, medallions, title letters ---------- */
const INTRO=group(scene);
const burstTex=canvasTex(1024,1024,(g,w,h)=>{ const n=24; g.translate(w/2,h/2); for(let i=0;i<n;i++){ g.fillStyle=i%2?'#FFD84D':'#FFC21F'; g.beginPath(); g.moveTo(0,0); g.arc(0,0,w*0.72,i/n*TAU,(i+1)/n*TAU); g.closePath(); g.fill(); }
  const rg=g.createRadialGradient(0,0,0,0,0,w*0.5); rg.addColorStop(0,'rgba(255,255,255,0.85)'); rg.addColorStop(0.22,'rgba(255,255,255,0.25)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(-w,-h,2*w,2*h); });
const burst=new THREE.Mesh(new THREE.CircleGeometry(34,64),basic(0xFFFFFF,{map:burstTex})); burst.position.set(0,3,-7); INTRO.add(burst);
const MED_COL=[0xFF5FA2,0x3BA7F0,0x3DC47E];
const INTRO_X=[-3.4,0,3.4];
const INTRO_KIDS=[KC,KB,KA];
const POP=[BEAT*1,BEAT*4,BEAT*7];
const meds=INTRO_KIDS.map((R,i)=>{ const g=group(INTRO,[INTRO_X[i],1.75,-1.3]);
  part(GEO.disc,basic(0xFFFFFF),g,{p:[0,0,-0.02],s:1.88,o:0,cast:false});
  part(GEO.disc,basic(0x221C24),g,{p:[0,0,-0.04],s:1.98,o:0,cast:false});
  part(GEO.disc,basic(MED_COL[i]),g,{s:1.68,o:0,cast:false});
  const dots=canvasTex(256,256,(c,w)=>{ c.fillStyle='rgba(255,255,255,0.28)'; for(let y=0;y<8;y++) for(let x=0;x<8;x++){ c.beginPath(); c.arc((x+0.5+(y%2)*0.5)*w/8,(y+0.5)*w/8,7,0,TAU); c.fill(); } });
  part(GEO.disc,basic(0xFFFFFF,{map:dots,transparent:true}),g,{p:[0,0,0.01],s:1.68,o:0,cast:false});
  return g; });
function stadium(hl,r){ const s=new THREE.Shape(); s.moveTo(-hl+r,-r); s.lineTo(hl-r,-r); s.absarc(hl-r,0,r,-Math.PI/2,Math.PI/2,false); s.lineTo(-hl+r,r); s.absarc(-hl+r,0,r,Math.PI/2,Math.PI*1.5,false); return s; }
function barGeo(len,w,d){ const g=new THREE.ExtrudeGeometry(stadium(len/2+w/2,w/2),{depth:d,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:2,curveSegments:10}); g.translate(0,0,-d/2); return g; }
const LETTER_DEFS=[
  ['Л',0xFF5A4E,[[0.12,0.14,0.36,1.26],[0.32,1.26,0.86,1.26],[0.86,0.14,0.86,1.26]]],
  ['У',0xFFA531,[[0.86,1.26,0.28,0.14],[0.14,1.26,0.52,0.6]]],
  ['Д',0xFFD23F,[[0.2,0.36,0.36,1.26],[0.36,1.26,0.82,1.26],[0.82,0.36,0.82,1.26],[0.04,0.36,0.96,0.36],[0.04,0.36,0.04,0.06],[0.96,0.36,0.96,0.06]]],
  ['И',0x3DC47E,[[0.14,0.14,0.14,1.26],[0.86,0.14,0.86,1.26],[0.14,0.22,0.86,1.18]]],
  ['К',0x3BA7F0,[[0.14,0.14,0.14,1.26],[0.24,0.7,0.86,1.26],[0.32,0.72,0.88,0.14]]],
  ['И',0x8E5CF0,[[0.14,0.14,0.14,1.26],[0.86,0.14,0.86,1.26],[0.14,0.22,0.86,1.18]]]
];
const LETTERS=LETTER_DEFS.map(([ch,col,bars],i)=>{
  const g=group(INTRO); const inner=group(g,[-0.5,-0.7,0]); const mat=toon(col);
  bars.forEach(([x1,y1,x2,y2])=>{ const len=Math.hypot(x2-x1,y2-y1), ang=Math.atan2(y2-y1,x2-x1);
    const m=new THREE.Mesh(barGeo(len,0.28,0.3),mat); m.position.set((x1+x2)/2,(y1+y2)/2,0); m.rotation.z=ang; m.castShadow=true; inner.add(m);
    const o=new THREE.Mesh(barGeo(len+0.07,0.35,0.37),OUT); o.position.copy(m.position); o.rotation.z=ang; inner.add(o); });
  return {g,i,t0:BEAT*11+i*BEAT*0.5,x:(i-2.5)*1.55};
});
const introFloor=new THREE.Mesh(new THREE.CircleGeometry(9,48),toon(0xFFF3C9)); introFloor.rotation.x=-Math.PI/2; introFloor.position.set(0,0.002,0); introFloor.receiveShadow=true; INTRO.add(introFloor);
const stars=[]; (function(){ const sh=new THREE.Shape(); for(let k=0;k<10;k++){ const a=Math.PI/2+k*Math.PI/5, r=k%2?0.45:1; k?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r); } const sg=new THREE.ShapeGeometry(sh); const r=rng(7);
  for(let i=0;i<14;i++){ const m=new THREE.Mesh(sg,basic([0xFFFFFF,0xFF5FA2,0x3BA7F0,0x3DC47E,0xFF5A4E][i%5])); const s=0.18+r()*0.22; m.scale.setScalar(s); INTRO.add(m);
    stars.push({m,x:(r()-0.5)*15,y:0.8+r()*6.5,z:-3.5+r()*1.5,ph:r()*TAU,sp:(r()-0.5)*3,s,t0:BEAT*10+r()*BEAT*6}); } })();

/* ---------- room set ---------- */
const ROOM=group(scene);
const WALLZ=-3;
const wallTex=canvasTex(512,256,(g,w,h)=>{ g.fillStyle='#CFE7F2'; g.fillRect(0,0,w,h); g.fillStyle='rgba(255,255,255,0.45)'; for(let x=0;x<w;x+=32){ g.fillRect(x,0,10,h); } });
wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping; wallTex.repeat.set(3,1);
const rwall=new THREE.Mesh(new THREE.PlaneGeometry(30,13),toon(0xFFFFFF,{map:wallTex})); rwall.position.set(0,6.5,WALLZ); rwall.receiveShadow=true; ROOM.add(rwall);
const floorTex=canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#E7C499'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(120,80,40,0.18)'; g.lineWidth=3; for(let y=0;y<h;y+=64){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); for(let x=(y/64%2)*96;x<w;x+=192){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+64); g.stroke(); } } });
floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(6,4);
const rfloor=new THREE.Mesh(new THREE.PlaneGeometry(60,40),toon(0xFFFFFF,{map:floorTex})); rfloor.rotation.x=-Math.PI/2; rfloor.position.set(0,0,WALLZ+20); rfloor.receiveShadow=true; ROOM.add(rfloor);
part(GEO.box,toon(0xFFFFFF),ROOM,{p:[0,0.15,WALLZ+0.05],s:[30,0.3,0.1],o:0});
const rug=part(GEO.disc,toon(0xF29A7A),ROOM,{p:[0,0.01,0.6],r:[-Math.PI/2,0,0],s:[3.6,2.4,1],o:0,cast:false,recv:true});
part(GEO.disc,toon(0xF7BFA6),ROOM,{p:[0,0.014,0.6],r:[-Math.PI/2,0,0],s:[2.9,1.85,1],o:0,cast:false,recv:true});
// sofa
(function(){ const S=group(ROOM,[0,0,-2.0]); const c1=toon(0x4C6FD8), c2=toon(0x5D80E6), leg=toon(0x6B4A30);
  part(GEO.box,c1,S,{p:[0,0.5,0],s:[5.4,0.55,1.15]});
  part(GEO.box,c1,S,{p:[0,1.25,-0.42],s:[5.4,1.2,0.36]});
  for(const sx of [-1,1]) part(GEO.box,c1,S,{p:[2.75*sx,0.85,0],s:[0.4,1.0,1.15]});
  for(const x of [-1.75,0,1.75]){ part(GEO.box,c2,S,{p:[x,0.86,0.04],s:[1.7,0.22,1.0]}); part(GEO.box,c2,S,{p:[x,1.35,-0.18],s:[1.6,0.8,0.22],r:[-0.08,0,0]}); }
  for(const sx of [-1,1]) for(const sz of [-1,1]) part(GEO.cyl,leg,S,{p:[2.6*sx,0.12,0.45*sz],s:[0.07,0.24,0.07]});
  part(GEO.box,toon(0xFFD23F),S,{p:[-2.0,1.25,0.0],s:[0.6,0.6,0.18],r:[0,0.3,0.15]});
})();
// window
(function(){ const W=group(ROOM,[-5.2,4.6,WALLZ+0.05]); const fr=toon(0xFFFFFF);
  part(GEO.box,basic(0x9ED8F5),W,{s:[2.6,2.2,0.02],o:0});
  const cl=basic(0xFFFFFF); [[-0.5,0.4,0.35],[-0.15,0.45,0.42],[0.25,0.38,0.32],[0.6,-0.35,0.25],[0.85,-0.3,0.2]].forEach(([x,y,s])=>part(GEO.sph,cl,W,{p:[x,y,0.02],s:[s,s*0.7,0.02],o:0,cast:false}));
  part(GEO.box,fr,W,{p:[0,1.15,0.06],s:[2.9,0.16,0.12]}); part(GEO.box,fr,W,{p:[0,-1.15,0.06],s:[2.9,0.16,0.12]}); part(GEO.box,fr,W,{p:[0,-1.25,0.16],s:[3.1,0.1,0.3]});
  for(const x of [-1.37,0,1.37]) part(GEO.box,fr,W,{p:[x,0,0.06],s:[0.14,2.3,0.12]});
})();
// poster with the painted wall from episode 1
(function(){ const tx=canvasTex(512,360,(g,w,h)=>{ g.fillStyle='#FFFFFF'; g.fillRect(0,0,w,h); g.lineCap='round'; g.strokeStyle='#4CB1EF'; g.lineWidth=34; g.beginPath(); for(let x=0;x<=w;x+=6){ const y=h*0.42+60*Math.sin(x/26); x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
    [['#FF7A3D',110,250,52],['#FFC93C',260,270,60],['#FF5FA2',400,240,50],['#8E5CF0',380,90,40],['#9BDB2F',110,90,40]].forEach(([c,x,y,r])=>{ g.fillStyle=c; g.beginPath(); for(let i=0;i<=20;i++){ const a=i/20*TAU, rr=r*(0.8+0.25*Math.sin(i*2.7)); i?g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):g.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); } g.fill(); });
    g.font='bold 64px sans-serif'; g.textAlign='center'; g.lineWidth=10; g.strokeStyle='#221C24'; g.strokeText('ЛУДИКИ',w/2,h*0.6); ['#FF5A4E','#FFA531','#FFD23F','#3DC47E','#3BA7F0','#8E5CF0'].forEach((c,i)=>{ g.fillStyle=c; g.fillText('ЛУДИКИ'[i],w/2-150+i*60,h*0.6); }); });
  const P=group(ROOM,[4.8,4.5,WALLZ+0.05]); part(GEO.box,toon(0x2A2C30),P,{s:[2.5,1.85,0.08],o:0}); part(new THREE.PlaneGeometry(2.3,1.65),basic(0xFFFFFF,{map:tx}),P,{p:[0,0,0.05],o:0,cast:false}); })();
// plant and lamp
(function(){ const P=group(ROOM,[-4.0,0,-1.6]); part(new THREE.CylinderGeometry(0.42,0.32,0.8,18),toon(0xE86A4A),P,{p:[0,0.4,0]});
  const lf=toon(0x3DAF6A), lf2=toon(0x52C77E); [[0,1.4,0,0.55],[-0.35,1.1,0.1,0.42],[0.38,1.15,0.05,0.45],[0.1,1.9,-0.05,0.4]].forEach(([x,y,z,s],i)=>part(GEO.sph,i%2?lf2:lf,P,{p:[x,y,z],s:[s,s*1.05,s]}));
  const L=group(ROOM,[4.2,0,-1.9]); part(GEO.cyl,toon(0x2A2C30),L,{p:[0,0.04,0],s:[0.35,0.08,0.35]}); part(GEO.cyl,toon(0x2A2C30),L,{p:[0,1.45,0],s:[0.04,2.8,0.04]});
  part(new THREE.CylinderGeometry(0.3,0.5,0.6,20,1,true),toon(0xFFE6A8,{side:THREE.DoubleSide}),L,{p:[0,2.95,0]}); })();

/* ---------- phone with the real bet slip ---------- */
const SW=0.2, SH=SW*2532/1170;
const slipCanvas=document.createElement('canvas'); slipCanvas.width=900; slipCanvas.height=1948;
const sg=slipCanvas.getContext('2d'); sg.fillStyle='#F2F2F4'; sg.fillRect(0,0,900,1948);
const slipTex=new THREE.CanvasTexture(slipCanvas); slipTex.anisotropy=renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1;
if(window.SLIP_SRC){ const im=new Image(); im.onload=()=>{ sg.drawImage(im,0,0,900,1948); slipTex.needsUpdate=true; dirty=true; }; im.src=window.SLIP_SRC; }
const phone=group(scene);
const phoneBody=part(GEO.box,toon(0x1E2024),phone,{s:[SW+0.026,SH+0.03,0.026],o:1.05});
part(new THREE.PlaneGeometry(SW,SH),basic(0xFFFFFF,{map:slipTex}),phone,{p:[0,0,0.0135],o:0,cast:false});
part(GEO.box,toon(0x34373D),phone,{p:[0.045,SH/2-0.05,-0.014],s:[0.06,0.06,0.008],o:0});
const ringTex=canvasTex(256,256,(g,w)=>{ g.strokeStyle='#4CD14C'; g.lineWidth=16; g.shadowColor='#4CD14C'; g.shadowBlur=24; g.beginPath(); g.arc(w/2,w/2,w*0.36,0,TAU); g.stroke(); });
const ring=part(new THREE.PlaneGeometry(1,1),basic(0xFFFFFF,{map:ringTex,transparent:true,depthWrite:false}),phone,{p:[0,0,0.0145],o:0,cast:false});
const scr=(u,v)=>[(u-0.5)*SW,(0.5-v)*SH]; // screenshot uv (0..1 from top-left) -> phone local

/* ---------- celebration props ---------- */
const plusTex=canvasTex(512,220,(g,w,h)=>{ g.font='900 170px "Rubik","Inter",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round'; g.lineWidth=34; g.strokeStyle='#221C24'; g.strokeText('+907',w/2,h/2+6); g.lineWidth=14; g.strokeStyle='#FFFFFF'; g.strokeText('+907',w/2,h/2+6); g.fillStyle='#35C13A'; g.fillText('+907',w/2,h/2+6); });
const plus=new THREE.Sprite(new THREE.SpriteMaterial({map:plusTex,transparent:true,depthWrite:false})); plus.visible=false; scene.add(plus);
const dotTex=canvasTex(32,32,g=>{ g.fillStyle='#fff'; g.beginPath(); g.arc(16,16,14,0,TAU); g.fill(); });
const confTex=canvasTex(32,32,g=>{ g.fillStyle='#fff'; g.beginPath(); if(g.roundRect) g.roundRect(4,10,24,12,5); else g.rect(4,10,24,12); g.fill(); });
function spr(tex,color,scale){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color,transparent:true,depthWrite:false})); s.scale.setScalar(scale); s.visible=false; scene.add(s); return s; }
const PALETTE=[0xFF5A4E,0xFFA531,0xFFD23F,0x3DC47E,0x3BA7F0,0x8E5CF0,0xFF5FA2];
const confetti=[]; (function(){ const r=rng(99); for(let i=0;i<90;i++){ const s=spr(confTex,PALETTE[i%PALETTE.length],0.26); confetti.push({s,t0:24.0+r()*5.5,x:(r()-0.5)*14,z:-1.8+r()*3.8,sp:2.0+r()*1.6,ph:r()*TAU,rot:(r()-0.5)*8}); } })();
const introConf=[]; (function(){ const r=rng(41); for(let i=0;i<60;i++){ const s=spr(confTex,PALETTE[i%PALETTE.length],0.3); introConf.push({s,t0:BEAT*18+r()*1.4,x:(r()-0.5)*15,z:-2+r()*3,sp:3+r()*2,ph:r()*TAU,rot:(r()-0.5)*8}); } })();
const coinGeo=new THREE.CylinderGeometry(0.16,0.16,0.045,22), coinMat=toon(0xFFC83D);
const coins=[]; (function(){ const r=rng(5); for(let i=0;i<36;i++){ const m=part(coinGeo,coinMat,scene,{o:1.12}); m.visible=false; coins.push({m,t0:24.15+r()*4.5,x:(r()-0.5)*9,z:-1.2+r()*2.6,sp:3.4+r()*2,rx:r()*6,ry:r()*6}); } })();

/* ---------- posing ---------- */
function resetRig(R){
  R.hips.position.y=R.hipsY; R.hips.rotation.set(0,0,0); R.head.rotation.set(0,0,0);
  for(const k of ['armA','armB','legA','legB']) R[k].rotation.set(0,0,0);
  R.armA.rotation.z=0.12; R.armB.rotation.z=-0.12; R.root.scale.setScalar(R.base); R.root.visible=true;
  face(R,{mouth:R.c.mouth});
}
function walk(R,t,amt,freq){ const ph=t*freq, s=Math.sin(ph)*0.75*amt; R.legA.rotation.x=s; R.legB.rotation.x=-s; R.armA.rotation.x+=-s*0.7; R.armB.rotation.x+=s*0.7; R.hips.position.y+=Math.abs(Math.cos(ph))*0.07*amt; }
function place(R,x,z,rot,lift){ R.root.position.set(x,lift||0,z); R.root.rotation.y=rot; }
function wave(R,t,k,arm){ const a=arm||R.armA; a.rotation.x=lerp(a.rotation.x,-2.7,k); a.rotation.z=lerp(a.rotation.z,(a===R.armA?1:-1)*(0.35+0.35*Math.sin(t*16)),k); }
function armsUp(R,t,k,o){ R.armA.rotation.x=lerp(R.armA.rotation.x,-2.8+0.2*Math.sin(t*11+o),k); R.armB.rotation.x=lerp(R.armB.rotation.x,-2.8+0.2*Math.sin(t*11+o+1.3),k); R.armA.rotation.z=lerp(R.armA.rotation.z,0.45,k); R.armB.rotation.z=lerp(R.armB.rotation.z,-0.45,k); }
function holdPhone(R,k,pitch){ const p=pitch===undefined?-1.5:pitch; R.armA.rotation.x=lerp(R.armA.rotation.x,p,k); R.armB.rotation.x=lerp(R.armB.rotation.x,p,k); R.armA.rotation.z=lerp(R.armA.rotation.z,-0.5,k); R.armB.rotation.z=lerp(R.armB.rotation.z,0.5,k); }
function talk(t,a,b,rate){ return t>a&&t<b?(0.45+0.55*Math.abs(Math.sin(t*(rate||13)))):0; }

/* intro: kids pop out of medallions in turn, then bounce on the beat while the title lands */
function poseIntro(t){
  INTRO_KIDS.forEach((R,i)=>{
    resetRig(R); const tp=POP[i];
    if(t<tp){ R.root.visible=false; return; }
    const u=seg(t,tp,tp+0.42); let y=lerp(-3.4,0,back(u));
    const land=t-(tp+0.42);
    if(land>=0&&land<0.22){ const s=bump(land,0,0.22); R.root.scale.set(R.base*(1+0.16*s),R.base*(1-0.2*s),R.base*(1+0.16*s)); }
    const happy={mouth:'grin',eye:1.08,brow:0.4,noLid:true};
    if(u<1){ R.armA.rotation.x=-2.8; R.armB.rotation.x=-2.8; face(R,{mouth:'open',eye:1.2,brow:0.7,noLid:true}); }
    else face(R,happy);
    // own close-up: wave and grin at camera
    const own=t<BEAT*10&&t>=tp+0.3; if(own&&t<(i<2?POP[i+1]:BEAT*10)) { wave(R,t,sm(seg(t,tp+0.3,tp+0.5))); R.head.rotation.z=0.12*Math.sin(t*8); }
    if(t>=BEAT*10){ // everybody bounces on the beat
      const bt=(t-BEAT*10)/BEAT, ph=bt%1; y+=0.42*Math.sin(Math.PI*ph)*(t<BEAT*22?1:0.5);
      const alt=Math.floor(bt)%2; R.armA.rotation.x=alt?-2.6:-0.4; R.armB.rotation.x=alt?-0.4:-2.6; R.armA.rotation.z=0.3; R.armB.rotation.z=-0.3;
      R.legA.rotation.x=0.25*Math.sin(Math.PI*ph); R.legB.rotation.x=-0.25*Math.sin(Math.PI*ph);
      if(t>=BEAT*11&&t<BEAT*15){ face(R,Object.assign({},happy,{ly:0.8})); R.head.rotation.x=-0.25; }
      if(t>=BEAT*18){ armsUp(R,t,sm(seg(t,BEAT*18,BEAT*18.6)),i); face(R,{mouth:'grin',squint:0.75,brow:0.5,noLid:true}); }
    }
    place(R,INTRO_X[i],0.1,(i-1)*-0.12,y);
  });
}

/* episode positions */
const A_HOME=[0,0.35], B_HOME=[-1.95,0.55], C_HOME=[1.95,0.55];
function poseEpisode(t){
  // ---------- A: the one with the phone ----------
  let R=KA; resetRig(R); let lift=0, ax=A_HOME[0], az=A_HOME[1], arot=0;
  const pull=sm(seg(t,10.2,10.9));
  if(t>=10.2&&t<20.6){ holdPhone(R,pull); R.head.rotation.x=0.32*pull; face(R,{mouth:'flat',ly:-1*pull,lx:0}); }
  if(t>=10.0&&t<10.2){ R.armA.rotation.x=0.25; R.armA.rotation.z=0.35; }
  if(t>=13.0&&t<14.0){ face(R,{mouth:'flat',ly:-1}); } // the one-second stare
  if(t>=14.0&&t<14.4){ const k=sm(seg(t,14.0,14.2)); face(R,{mouth:'flat',ly:-1,eye:1+0.12*k,brow:0.25*k}); }
  if(t>=14.4&&t<19.2) R.root.visible=false; // camera is in his eyes (phone POV)
  if(t>=19.2&&t<20.6){ const k=back(seg(t,19.2,19.45)); holdPhone(R,1); R.head.rotation.x=lerp(0.32,-0.12,k); R.hips.rotation.x=-0.08*k;
    face(R,{mouth:'open',mouthS:0.6+0.7*k,eye:1+0.42*k,brow:0.9*k,noLid:true,ly:lerp(-1,0,k)}); R.head.rotation.z=0.05*Math.sin(t*40)*(1-seg(t,19.3,20.2)); }
  if(t>=20.6&&t<24.0){ // turns the phone to the friends
    const k=sm(seg(t,20.6,21.2)); holdPhone(R,1,lerp(-1.5,-1.25,k)); R.head.rotation.x=lerp(-0.1,0.18,k);
    const g=t<23.0; face(R,{mouth:g?'grin':'grin',mouthS:g?0.8:1,eye:1.15,brow:0.55,noLid:true,lx:0,ly:-0.6*k});
    R.head.rotation.y=0.25*Math.sin((t-21)*2.4)*seg(t,21.2,21.6);
    if(t>=23.3){ const k2=sm(seg(t,23.3,23.6)); lift-=0.12*k2; R.legA.rotation.x=-0.3*k2; R.legB.rotation.x=-0.3*k2; R.hips.rotation.x=0.15*k2; }
  }
  if(t>=24.0){ // celebration: phone up high in one hand
    const ct=t-24.0, k=sm(seg(t,24.0,24.25)); lift+=0.9*Math.max(0,Math.sin(ct*Math.PI*2.2))*(t<31?1:0.3);
    R.armA.rotation.x=lerp(-1.25,-2.95,k); R.armA.rotation.z=0.18; R.armB.rotation.x=-2.5+0.35*Math.sin(t*9); R.armB.rotation.z=-0.5;
    face(R,{mouth:'grin',mouthS:1.05,eye:1.12,squint:ct%1.6<0.8?0:0.7,brow:0.6,noLid:true});
    R.legA.rotation.x=0.4*Math.sin(ct*13.8); R.legB.rotation.x=-0.4*Math.sin(ct*13.8);
    R.head.rotation.z=0.1*Math.sin(t*6);
  }
  if(t>=30.8){ face(R,{mouth:'grin',eye:1.12,brow:0.6,noLid:true,ly:0.1}); }
  if(t<10.2||t>=24.0) { const c=(t+0.4)%3.3; if(c<0.12&&t<20) R.eyes.forEach(e=>e.scale.y*=0.1); }
  place(R,ax,az,arot,lift);

  // ---------- B and C: chatting, then lean in, then go wild ----------
  [[KB,B_HOME,1,0.0],[KC,C_HOME,-1,1.7]].forEach(([R,H,side,o])=>{
    resetRig(R); let x=H[0], z=H[1], rot=0.55*side, l=0;
    if(t<12.0){ // chatting with each other
      const isB=R===KB; const sp=isB?talk(t,9.3,10.6,12):talk(t,10.8,11.9,14);
      face(R,{mouth:sp?'open':R.c.mouth,mouthS:sp,lx:0.6*side,ly:0});
      if(isB&&t<10.6){ R.armA.rotation.x=-1.1-0.3*Math.sin(t*7); R.armA.rotation.z=-0.2; }
      if(!isB&&t>10.8){ R.armB.rotation.x=-1.0-0.25*Math.sin(t*8); R.hips.rotation.z=0.05*Math.sin(t*14); face(R,{mouth:'grin',mouthS:0.6+0.3*Math.abs(Math.sin(t*14)),squint:0.6,lx:0.6*side}); }
      const c=(t+o)%3.3; if(c<0.12) R.eyes.forEach(e=>e.scale.y*=0.1);
    } else if(t<20.6){ // glancing at A
      rot=lerp(0.55,0.35,sm(seg(t,12,13)))*side; face(R,{mouth:R.c.mouth,lx:0.8*side,ly:-0.2});
      if(t>=19.3){ face(R,{mouth:'flat',lx:0.9*side,eye:1.1,brow:0.3}); R.head.rotation.z=-0.1*side; }
      const c=(t+o)%3.3; if(c<0.12) R.eyes.forEach(e=>e.scale.y*=0.1);
    } else if(t<24.0){ // step in, lean over the phone
      const k=sm(seg(t,20.7,21.6)); x=lerp(H[0],-1.05*side,k);
      z=lerp(H[1],0.75,k); rot=lerp(0.35,0.95,k)*side;
      if(k>0&&k<1) walk(R,t,0.8,11);
      const lean=sm(seg(t,21.3,21.8)); R.hips.rotation.x=0.22*lean; R.head.rotation.x=0.25*lean; R.head.rotation.y=-0.35*side*lean;
      if(t<22.3) face(R,{mouth:R.c.mouth,lx:0.8*side*(1-lean)-0.3*side*lean,ly:-0.6*lean});
      else { const kk=back(seg(t,22.3,22.55)); face(R,{mouth:'open',mouthS:0.5+0.8*kk,eye:1+0.45*kk,brow:0.9*kk,ly:-0.5,lx:-0.3*side}); R.hips.rotation.x=lerp(0.22,-0.1,kk); R.head.rotation.x=lerp(0.25,-0.1,kk);
        R.armA.rotation.x=-0.6*kk; R.armB.rotation.x=-0.6*kk; R.armA.rotation.z=0.12+0.5*kk; R.armB.rotation.z=-0.12-0.5*kk; }
      if(t>=23.3){ const k2=sm(seg(t,23.3,23.6)); l-=0.12*k2; R.legA.rotation.x=-0.3*k2; R.legB.rotation.x=-0.3*k2; }
    } else { // celebrate
      const ct=t-24.0; const k=sm(seg(t,24.0,24.5)); x=lerp(-1.05*side,H[0]*0.85,k); z=lerp(0.75,0.6,k); rot=lerp(0.95,0.22,k)*side;
      l+=0.95*Math.max(0,Math.sin(ct*Math.PI*2.2+o))*(t<31?1:0.3);
      armsUp(R,t,sm(seg(t,24.0,24.2)),o);
      R.legA.rotation.x=0.4*Math.sin(ct*13.8+o); R.legB.rotation.x=-0.4*Math.sin(ct*13.8+o);
      face(R,{mouth:'grin',mouthS:1.05,eye:1.1,squint:(ct+o*0.4)%1.6<0.8?0.7:0,brow:0.6,noLid:true});
      R.head.rotation.z=0.12*Math.sin(t*6+o);
      if(R===KC&&t>=26.4&&t<27.4){ R.hips.rotation.y=TAU*sm(seg(t,26.4,27.2)); } // KC spins
    }
    place(R,x,z,rot,l);
  });
}

/* phone placement per frame */
const _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3(), _q=new THREE.Quaternion();
function posePhone(t){
  phone.visible=t>=10.0; ring.visible=false;
  if(!phone.visible) return;
  KA.root.updateMatrixWorld(true);
  const a=KA.handA.getWorldPosition(_v), b=KA.handB.getWorldPosition(_v2);
  if(t<24.0){
    const both=sm(seg(t,10.5,10.9)); const mid=_v3.copy(a).lerp(b,0.5);
    phone.position.copy(a).lerp(mid,both); phone.position.y+=0.1*both;
    // screen faces his eyes, then turns to the friends (and to us)
    const head=KA.head.getWorldPosition(new THREE.Vector3()); head.y+=0.06;
    const out=phone.position.clone().add(new THREE.Vector3(0,0.35,1));
    const turn=t<20.6?0:sm(seg(t,20.6,21.15));
    const tgt=head.lerp(out,turn);
    if(turn>0&&turn<1){ tgt.x+=Math.sin(turn*Math.PI)*0.9; }
    phone.lookAt(tgt);
    if(t<10.5) phone.rotateX(-1.2*(1-sm(seg(t,10.0,10.5))));
  } else {
    phone.position.copy(a); phone.position.y+=0.16;
    phone.lookAt(phone.position.clone().add(new THREE.Vector3(0,0.15,1)));
    phone.rotateZ(0.15*Math.sin(t*7));
  }
  // highlight ring over checkmarks / the winnings during the POV
  const R_EV=[[15.85,0.905,0.315,0.09],[16.35,0.905,0.475,0.09],[16.85,0.905,0.635,0.09],[17.9,0.87,0.213,0.2]];
  for(const [t0,u,v,s] of R_EV){ const dur=t0>17?1.3:0.45; if(t>=t0&&t<t0+dur){ ring.visible=true; const k=seg(t,t0,t0+0.25); const p=scr(u,v); ring.position.set(p[0],p[1],0.0145); const sz=s*SW*(0.6+0.4*back(k)); ring.scale.set(sz*(t0>17?2.2:1),sz*(t0>17?1.1:1),1); ring.material.opacity=t0>17?0.75+0.25*Math.sin(t*12):1-seg(t,t0+0.25,t0+dur)*0.7; } }
}

/* ---------- camera ---------- */
const _h=new THREE.Vector3();
function headPos(R){ R.root.updateMatrixWorld(true); return R.head.getWorldPosition(_h).clone(); }
function cameraAt(t){
  camera.up.set(0,1,0); let roll=0, p, q, fov=40;
  if(t<BEAT*10){ // intro close-ups, each slightly tilted and pushing in
    const i=t<POP[1]-0.15?0:(t<POP[2]-0.15?1:2), x=INTRO_X[i], s0=i?POP[i]-0.15:0, s1=i<2?POP[i+1]-0.15:BEAT*10, k=seg(t,s0,s1);
    p=[x+0.55*(i===1?-1:1),2.0,lerp(4.6,3.7,sm(k))]; q=[x,1.85,0]; roll=(i===1?-1:1)*0.06;
  } else if(t<BEAT*18){ const k=sm(seg(t,BEAT*10,BEAT*11.4)); const x=INTRO_X[2];
    p=[lerp(x+0.55,0,k),lerp(2.0,2.7,k),lerp(3.7,13.2,k)]; q=[lerp(x,0,k),lerp(1.85,2.75,k),0]; roll=lerp(0.06,0,k); }
  else { const k=sm(seg(t,BEAT*18,BEAT*24)); p=[0,2.7,lerp(13.2,11.6,k)]; q=[0,2.75,0]; roll=0.025*Math.sin(t*3); }
  if(t>=9.0){
    if(t<12.0){ const k=sm(seg(t,9.0,12.0)); p=[lerp(-0.6,0,k),lerp(2.6,2.3,k),lerp(10.2,8.0,k)]; q=[0,1.8,0]; }
    else if(t<14.4){ const hp=headPos(KA); const k=sm(seg(t,12.0,14.4)); p=[hp.x+lerp(0.55,0.35,k),hp.y-0.1,hp.z+lerp(2.9,2.35,k)]; q=[hp.x,hp.y-0.3,hp.z]; }
    else if(t<19.2){ // POV: we look into his phone
      phone.updateMatrixWorld(true);
      const K=[[14.4,[0.5,0.5,0.62]],[15.0,[0.5,0.5,0.56]],[15.65,[0.5,0.18,0.2]],[15.85,[0.5,0.3,0.17]],[16.35,[0.5,0.46,0.17]],[16.85,[0.5,0.62,0.17]],[17.25,[0.5,0.62,0.17]],[17.85,[0.75,0.205,0.11]],[19.2,[0.78,0.21,0.088]]];
      let a=K[0],b=K[K.length-1]; for(let i=0;i<K.length-1;i++) if(t>=K[i][0]&&t<K[i+1][0]){ a=K[i]; b=K[i+1]; break; }
      const k=sm(seg(t,a[0],b[0])), u=lerp(a[1][0],b[1][0],k), v=lerp(a[1][1],b[1][1],k), d=lerp(a[1][2],b[1][2],k);
      const sp=scr(u,v); const c=phone.localToWorld(new THREE.Vector3(sp[0],sp[1],0.0135)); const e=phone.localToWorld(new THREE.Vector3(sp[0],sp[1],0.0135+d));
      camera.position.copy(e); camera.up.copy(new THREE.Vector3(0,1,0).applyQuaternion(phone.getWorldQuaternion(_q))); camera.lookAt(c);
      if(t>=17.85&&t<18.1&&!reduceMotion){ camera.position.x+=Math.sin(t*90)*0.002; }
      return;
    }
    else if(t<20.6){ const hp=headPos(KA); const k=back(seg(t,19.2,19.4)); p=[hp.x+0.05,hp.y-0.05,hp.z+lerp(2.7,2.15,k)]; q=[hp.x,hp.y-0.2,hp.z]; }
    else if(t<24.0){ const k=sm(seg(t,20.6,22.0)); p=[lerp(0,0.3,k),2.15,lerp(5.4,4.6,k)]; q=[0,1.95,0.4]; }
    else if(t<27.0){ const k=sm(seg(t,24.0,24.6)); p=[lerp(0.3,1.2*Math.sin((t-24)*0.5),k),lerp(2.15,1.45,k),lerp(4.6,8.4,k)]; q=[0,lerp(1.95,2.5,k),0]; }
    else if(t<29.7){ const who=t<27.9?KB:(t<28.8?KC:KA), s0=t<27.9?27.0:(t<28.8?27.9:28.8); const hp=headPos(who); const k=sm(seg(t,s0,s0+0.9));
      p=[hp.x+(who===KC?-0.4:0.4),hp.y+0.05,hp.z+lerp(2.5,2.1,k)]; q=[hp.x,hp.y-0.05,hp.z]; roll=(who===KC?-1:1)*0.05; }
    else { const k=sm(seg(t,29.7,30.5)); p=[0,lerp(1.7,1.9,k),lerp(7.0,8.8,k)]; q=[0,2.3,0]; }
  }
  camera.position.set(p[0],p[1],p[2]); camera.lookAt(q[0],q[1],q[2]); if(roll) camera.rotateZ(roll);
  camera.fov=fov; camera.updateProjectionMatrix();
}

/* ---------- props per frame ---------- */
function poseProps(t){
  const intro=t<9.0; INTRO.visible=intro; ROOM.visible=!intro;
  key.target.position.set(0,1,-1); key.position.set(4,12,10);
  burst.rotation.z=-t*0.55; burst.scale.setScalar(t<0.4?sm(t/0.4)*0.9+0.1:1);
  meds.forEach((g,i)=>{ const k=elastic(seg(t,POP[i]-0.1,POP[i]+0.6)); g.scale.setScalar(Math.max(0.001,k)); g.rotation.z=0.15*Math.sin(t*2+i); g.position.y=1.75+(t>BEAT*10?0.08*Math.sin(t*Math.PI/BEAT):0); });
  LETTERS.forEach(L=>{ const g=L.g; if(t<L.t0){ g.visible=false; return; } g.visible=true; const k=seg(t,L.t0,L.t0+0.32), after=t-(L.t0+0.32);
    let y=lerp(11,4.55,k*k); if(after>0) y=4.55+0.45*Math.abs(Math.sin(after*9))*Math.exp(-after*5);
    if(t>BEAT*18) y+=0.15*Math.max(0,Math.sin((t-BEAT*18)*Math.PI/BEAT+L.i*0.6));
    g.position.set(L.x,y,-0.4); const sq=after>0&&after<0.15?bump(after,0,0.15):0; g.scale.set(1.25*(1+0.2*sq),1.25*(1-0.25*sq),1.25); g.rotation.set(0,0,(after>0?0.12*Math.sin(after*11+L.i)*Math.exp(-after*3):0.5*(1-k)*(L.i%2?1:-1))+0.04*Math.sin(t*2+L.i)); });
  stars.forEach(s=>{ const k=back(seg(t,s.t0,s.t0+0.4)); s.m.visible=intro&&t>=s.t0; s.m.position.set(s.x,s.y+0.2*Math.sin(t*2+s.ph),s.z); s.m.rotation.z=t*s.sp; s.m.scale.setScalar(Math.max(0.001,s.s*k)); });
  introConf.forEach(c=>{ const k=t-c.t0; if(!intro||k<0){ c.s.visible=false; return; } const y=10-k*c.sp; if(y<-0.3){ c.s.visible=false; return; } c.s.visible=true; c.s.position.set(c.x+0.5*Math.sin(k*2+c.ph),y,c.z); c.s.material.rotation=k*c.rot; });
  // phone glow on A's face while he stares at the screen
  glow.intensity=(t>=10.6&&t<14.4)?0.35*sm(seg(t,10.6,11.2)):(t>=19.2&&t<20.6?0.35:0);
  if(glow.intensity>0){ glow.position.copy(phone.position); _v.set(0,0,0.25).applyQuaternion(phone.quaternion); glow.position.add(_v); }
  // +907, confetti, coins
  if(t>=24.1){ plus.visible=true; const k=back(seg(t,24.1,24.5)); plus.position.set(0,4.15+0.12*Math.sin(t*3),-0.6); const s=2.9*k*(1+0.05*Math.sin(t*8)); plus.scale.set(s,s*220/512,1); plus.material.rotation=0.06*Math.sin(t*2.5); }
  else plus.visible=false;
  if(t>=27.0&&t<29.7) plus.visible=false;
  confetti.forEach(c=>{ const k=t-c.t0; if(k<0||intro){ c.s.visible=false; return; } const y=8.5-k*c.sp; if(y<-0.3){ c.s.visible=false; return; } c.s.visible=true; c.s.position.set(c.x+0.5*Math.sin(k*2+c.ph),y,c.z); c.s.material.rotation=k*c.rot; });
  coins.forEach(c=>{ const k=t-c.t0; if(k<0||intro){ c.m.visible=false; return; } let y=8.5-k*c.sp-2*k*k; if(y<0.06){ y=0.06; } c.m.visible=true; c.m.position.set(c.x,y,c.z); if(y>0.06){ c.m.rotation.set(k*c.rx,0,k*c.ry); } else c.m.rotation.set(0,c.ry,0); });
}

/* ---------- overlays: episode title, iris wipe, end card ---------- */
function overlays(t){
  const w=stage.clientWidth, h=stage.clientHeight;
  // title card
  const ta=BEAT*18.5, tk=back(seg(t,ta,ta+0.4)), to=1-sm(seg(t,8.15,8.5));
  if(t>=ta&&t<9.0){ ovTitle.style.opacity=String(to); ovTitle.style.transform='translate(-50%,0) scale('+(0.2+0.8*tk).toFixed(3)+') rotate('+(-4+2*Math.sin(t*5)).toFixed(2)+'deg)'; ovTitle.hidden=false; } else ovTitle.hidden=true;
  // iris wipe (closing into the first scene, opening on the room, closing at the end)
  let r=-1, cx=w/2, cy=h/2; const full=Math.hypot(w,h)*0.6;
  if(t>=8.4&&t<9.0) r=full*(1-sm(seg(t,8.4,8.95)));
  else if(t>=9.0&&t<9.7) r=full*sm(seg(t,9.05,9.7));
  else if(t>=31.2){ r=full*(1-sm(seg(t,31.2,32.6))); const hp=headPos(KA); hp.project(camera); cx=(hp.x+1)/2*w; cy=(1-hp.y)/2*h; r=Math.max(r,t<32.6?Math.min(w,h)*0.16*(1-seg(t,32.3,32.6)):0); }
  if(r>=0&&r<full){ ovIris.hidden=false; ovIris.style.background='radial-gradient(circle at '+cx.toFixed(1)+'px '+cy.toFixed(1)+'px, transparent '+r.toFixed(1)+'px, #111 '+(r+1.5).toFixed(1)+'px)'; }
  else ovIris.hidden=true;
  if(t>=32.6){ ovIris.hidden=false; ovIris.style.background='#111'; }
  if(t>=32.7){ ovEnd.hidden=false; ovEnd.style.opacity=String(sm(seg(t,32.7,33.2))); } else ovEnd.hidden=true;
}

/* ---------- audio ---------- */
const AudioEngine=(function(){
  let ctx=null, master=null, noiseBuf=null, muted=false; const EV=[]; let idx=0;
  const ev=(t,k,o)=>EV.push(Object.assign({t,k},o||{}));
  // ---- intro theme: 160 BPM, bouncy oom-pah with a bright whistly lead ----
  const CH={C:[48,60,64,67],Am:[45,57,60,64],F:[41,57,60,65],G:[43,55,59,62],Dm:[50,57,62,65]};
  const INTRO_BARS=['C','Am','F','G','C','G'];
  const LEAD=[ 72,0,76,79, 84,0,79,76,  76,0,72,69, 72,76,74,72,  77,0,81,84, 81,77,72,77,  79,0,83,86, 83,0,79,0,  84,83,84,79, 76,79,84,88,  86,0,83,0, 84,0,0,0 ];
  function theme(t0,bars,lead,vol){
    bars.forEach((name,bi)=>{ const ch=CH[name], b0=t0+bi*BEAT*4;
      for(let j=0;j<4;j++){ const tb=b0+j*BEAT;
        if(j%2===0){ ev(tb,'kick'); ev(tb,'bass',{f:midi(ch[0]+(j===2?7:0)-12),v:0.2*vol}); }
        else { ev(tb,'clap',{v:vol}); [1,2,3].forEach(n=>ev(tb,'stab',{f:midi(ch[n]),v:0.05*vol})); }
        ev(tb+BEAT/2,'hat',{v:vol}); ev(tb,'hat',{v:0.5*vol});
      }
      if(lead) for(let e=0;e<8;e++){ const m=LEAD[(bi*8+e)%LEAD.length]; if(m) ev(b0+e*BEAT/2,'lead',{f:midi(m),v:0.05*vol}); }
    });
  }
  ev(0,'whistle'); theme(0,INTRO_BARS,true,1);
  POP.forEach((p,i)=>{ ev(p,'boing',{f:[220,262,330][i]}); ev(p+0.05,'sparkle',{b:[72,76,79][i]}); });
  for(let i=0;i<6;i++) ev(BEAT*11+i*BEAT*0.5+0.32,'chime',{f:midi([72,74,76,79,81,84][i])});
  ev(BEAT*18,'tada'); ev(BEAT*18.5,'whoosh',{v:0.25}); ev(8.4,'iris'); ev(BEAT*22,'final');
  // ---- episode ----
  const CALM=[['C',9.4],['Am',10.6],['F',11.8]];
  CALM.forEach(([n,t0])=>{ const ch=CH[n]; for(let i=0;i<6;i++) ev(t0+i*0.2,'pluck',{f:midi(ch[1+i%3]+12*(i>2?1:0)),v:0.05}); ev(t0,'bass',{f:midi(ch[0]),v:0.1}); });
  ev(10.0,'swish'); ev(10.55,'tap'); ev(10.75,'tap');
  ev(13.0,'tick'); ev(13.5,'tock'); ev(14.0,'tick');
  ev(14.4,'ding');
  [15.85,16.35,16.85].forEach((s,i)=>ev(s,'pling',{f:midi([76,79,84][i])}));
  for(let s=17.2;s<17.85;s+=0.04) ev(s,'snare',{v:0.04+0.12*seg(s,17.2,17.85)});
  ev(17.85,'kaching'); ev(17.9,'tada');
  ev(19.2,'slide'); ev(19.25,'boing',{f:180});
  ev(20.6,'whoosh',{v:0.2}); ev(21.6,'pluck',{f:midi(67),v:0.05}); ev(21.9,'pluck',{f:midi(71),v:0.05});
  ev(22.3,'gasp'); ev(22.35,'stab3');
  ev(22.9,'riser');
  ev(24.0,'tada'); ev(24.0,'kaching'); ev(24.05,'cheer');
  theme(24.0,['C','Am','F','G','C'],true,0.95);
  for(let i=0;i<14;i++) ev(24.2+i*0.33,'coin',{f:midi(88+(i%3)*3)});
  ev(27.0,'boing',{f:262}); ev(27.9,'boing',{f:330}); ev(28.8,'boing',{f:392});
  ev(31.2,'iris'); ev(31.5,'final'); ev(32.6,'pop');
  EV.sort((a,b)=>a.t-b.t);
  function env(g,time,peak,a,d){ g.gain.setValueAtTime(0.0001,time); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),time+a); g.gain.exponentialRampToValueAtTime(0.0001,time+a+d); }
  function osc(time,type,f,dur,vol,f2,a){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,time); if(f2) o.frequency.exponentialRampToValueAtTime(f2,time+dur); env(g,time,vol,a||0.008,dur); o.connect(g); g.connect(master); o.start(time); o.stop(time+dur+0.05); }
  function nz(time,dur,vol,ftype,f,f2,q,a){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; const fl=ctx.createBiquadFilter(); fl.type=ftype; fl.frequency.setValueAtTime(f,time); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,time+dur); fl.Q.value=q||1; const g=ctx.createGain(); env(g,time,vol,a||0.005,dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(time,Math.random()*2); s.stop(time+dur+0.05); }
  function vib(time,f,dur,vol){ const o=ctx.createOscillator(), l=ctx.createOscillator(), lg=ctx.createGain(), g=ctx.createGain(); o.type='square'; o.frequency.value=f; l.frequency.value=6.5; lg.gain.value=f*0.012; l.connect(lg); lg.connect(o.frequency); env(g,time,vol,0.01,dur);
    const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=3200; o.connect(fl); fl.connect(g); g.connect(master); o.start(time); l.start(time); o.stop(time+dur+0.05); l.stop(time+dur+0.05); }
  const PLAY={
    kick:w=>osc(w,'sine',150,0.16,0.42,45), bass:(w,e)=>osc(w,'triangle',e.f,0.2,e.v),
    stab:(w,e)=>osc(w,'square',e.f,0.09,e.v), clap:(w,e)=>{ nz(w,0.08,0.12*(e.v||1),'bandpass',1500,1200,0.8); nz(w+0.012,0.06,0.07*(e.v||1),'bandpass',1800,1300,0.8); },
    hat:(w,e)=>nz(w,0.03,0.035*(e.v||1),'highpass',7500), lead:(w,e)=>{ vib(w,e.f,0.17,e.v); osc(w,'triangle',e.f*2,0.12,e.v*0.5); },
    pluck:(w,e)=>osc(w,'triangle',e.f,0.35,e.v), snare:(w,e)=>nz(w,0.05,e.v,'bandpass',1900,1500,0.7),
    whistle:w=>{ osc(w,'sine',600,0.4,0.12,1800); }, boing:(w,e)=>osc(w,'triangle',e.f||200,0.3,0.24,(e.f||200)*2.6),
    sparkle:(w,e)=>{ [0,4,7,12].forEach((m,i)=>osc(w+i*0.04,'triangle',midi(e.b+12+m),0.25,0.06)); },
    chime:(w,e)=>{ osc(w,'triangle',e.f,0.5,0.13); osc(w,'sine',e.f*2,0.35,0.05); }, whoosh:(w,e)=>nz(w,0.35,e.v,'bandpass',500,2600,0.8),
    tada:w=>{ [60,64,67,72,76].forEach((m,i)=>osc(w+i*0.02,'triangle',midi(m),1.2,0.08)); osc(w,'sine',midi(36),0.9,0.2); nz(w,1.0,0.1,'highpass',4500,3000); },
    final:w=>{ [48,60,64,67,72,79].forEach(m=>osc(w,'triangle',midi(m),1.4,0.06)); },
    iris:w=>osc(w,'sine',900,0.45,0.08,200), pop:w=>osc(w,'sine',400,0.12,0.2,1400),
    swish:w=>nz(w,0.25,0.12,'bandpass',900,3000,1), tap:w=>{ osc(w,'sine',1800,0.03,0.05); nz(w,0.02,0.04,'highpass',3000); },
    tick:w=>{ osc(w,'square',2400,0.025,0.05); nz(w,0.02,0.06,'highpass',5000); }, tock:w=>{ osc(w,'square',1600,0.025,0.05); nz(w,0.02,0.05,'highpass',3500); },
    ding:w=>{ osc(w,'sine',midi(88),0.5,0.12); osc(w+0.12,'sine',midi(93),0.7,0.12); },
    pling:(w,e)=>{ osc(w,'triangle',e.f,0.35,0.12); osc(w,'sine',e.f*2,0.25,0.05); },
    kaching:w=>{ [0,0.05,0.1].forEach((d,i)=>osc(w+d,'square',midi(96+i*2),0.12,0.04)); osc(w+0.16,'triangle',midi(100),0.6,0.09); nz(w,0.15,0.12,'highpass',6000); },
    slide:w=>osc(w,'sine',300,0.4,0.13,1400),
    gasp:w=>nz(w,0.35,0.12,'bandpass',1200,2000,2,0.08), stab3:w=>{ [55,59,62,65].forEach(m=>osc(w,'square',midi(m),0.25,0.035)); },
    riser:w=>{ nz(w,1.1,0.18,'bandpass',400,6000,1.2,0.9); osc(w,'sawtooth',110,1.1,0.03,440,1.0); },
    cheer:w=>{ for(let i=0;i<10;i++) nz(w+i*0.18,0.5,0.06,'bandpass',900+((i*317)%900),1200+((i*211)%800),1.5,0.1); },
    coin:(w,e)=>{ osc(w,'square',e.f,0.06,0.025); osc(w+0.06,'square',e.f*1.335,0.18,0.025); }
  };
  return {
    init(){ if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; } const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; try{ ctx=new AC(); }catch(e){ ctx=null; return; }
      master=ctx.createGain(); master.gain.value=muted?0:0.85; const comp=ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      const len=ctx.sampleRate*3; noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; },
    seek(T){ idx=0; while(idx<EV.length&&EV[idx].t<T) idx++; },
    tick(T){ if(!ctx) return; const now=ctx.currentTime; while(idx<EV.length&&EV[idx].t<=T+0.12){ const e=EV[idx]; if(e.t>=T-0.06){ try{ PLAY[e.k](now+Math.max(0,e.t-T),e); }catch(err){} } idx++; } },
    setMuted(m){ muted=m; if(ctx&&master) master.gain.setTargetAtTime(m?0:0.85,ctx.currentTime,0.05); }
  };
})();

/* ---------- playback ---------- */
let T=0, playing=false, last=performance.now(), dirty=true, scrubbing=false, muted=false, posterVisible=true;
const PLAY_D='M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z', PAUSE_D='M6 4h4v16H6zM14 4h4v16h-4z';
const fmt=s=>{ s=Math.floor(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function render(){
  const t=posterVisible?POSTER_T:T;
  if(t<9.0) poseIntro(t); else poseEpisode(t);
  poseProps(t); posePhone(t); cameraAt(t);
  renderer.render(scene,camera);
  overlays(posterVisible?POSTER_T:t);
  timeEl.innerHTML='<b>'+fmt(T)+'</b> / 0:34';
  if(!scrubbing) scrub.value=Math.round(T*10);
}
function setPlaying(p){
  playing=p; playIcon.setAttribute('d',p?PAUSE_D:PLAY_D); playBtn.setAttribute('aria-label',p?'Пауза':'Смотреть');
  if(p){ try{ AudioEngine.init(); AudioEngine.seek(T); }catch(e){} posterVisible=false; posterEl.hidden=true; last=performance.now(); }
  dirty=true;
}
function play(){ if(T>=DUR-0.01) T=0; setPlaying(true); }
function pause(){ setPlaying(false); }
function seek(t){ T=clamp(t,0,DUR); AudioEngine.seek(T); if(posterVisible){ posterVisible=false; posterEl.hidden=true; } dirty=true; }
function frame(now){
  const dt=Math.min((now-last)/1000,0.1); last=now;
  if(playing){ T=Math.min(DUR,T+dt); AudioEngine.tick(T); if(T>=DUR){ setPlaying(false); posterEp.textContent='Конец серии'; startLabel.textContent='Смотреть ещё раз'; posterVisible=true; posterEl.hidden=false; } dirty=true; }
  if(dirty){ dirty=false; try{ render(); }catch(e){ window.__report('кадр: '+((e&&e.message)||e)); } }
  requestAnimationFrame(frame);
}
startBtn.addEventListener('click',e=>{ e.stopPropagation(); if(T>=DUR-0.01) T=0; play(); });
posterEl.addEventListener('click',e=>{ if(e.target===posterEl){ if(T>=DUR-0.01) T=0; play(); } });
stage.addEventListener('click',e=>{ if(posterEl.contains(e.target)) return; playing?pause():play(); });
playBtn.addEventListener('click',()=>{ playing?pause():play(); });
scrub.addEventListener('input',()=>{ scrubbing=true; seek(scrub.value/10); });
scrub.addEventListener('change',()=>{ scrubbing=false; });
soundBtn.addEventListener('click',()=>{ muted=!muted; AudioEngine.setMuted(muted); soundBtn.setAttribute('aria-pressed',String(muted)); soundBtn.setAttribute('aria-label',muted?'Включить звук':'Выключить звук'); soundIcon.setAttribute('d',muted?'M4 9h3.5L12 5v14l-4.5-4H4zM16 9l5 6M21 9l-5 6':'M4 9h3.5L12 5v14l-4.5-4H4zM15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12'); });
if(!(document.fullscreenEnabled&&playerEl.requestFullscreen)) fsBtn.hidden=true;
fsBtn.addEventListener('click',()=>{ try{ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); else { const r=playerEl.requestFullscreen(); if(r&&r.catch) r.catch(()=>{}); } }catch(e){} });
document.addEventListener('keydown',e=>{
  const tag=e.target&&e.target.tagName;
  if(tag==='TEXTAREA'||(tag==='INPUT'&&e.target.type!=='range')) return;
  if(e.code==='Space'&&tag!=='BUTTON'){ e.preventDefault(); playing?pause():play(); }
  else if(e.code==='ArrowRight'&&e.target===document.body) seek(T+2);
  else if(e.code==='ArrowLeft'&&e.target===document.body) seek(T-2);
});
function resize(){ const w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); dirty=true; }
if(window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
resize();
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ /* redraw +907 with the round font once it loads */ const c=plusTex.image, g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); g.font='900 170px "Rubik","Inter",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round'; g.lineWidth=34; g.strokeStyle='#221C24'; g.strokeText('+907',256,116); g.lineWidth=14; g.strokeStyle='#FFFFFF'; g.strokeText('+907',256,116); g.fillStyle='#35C13A'; g.fillText('+907',256,116); plusTex.needsUpdate=true; dirty=true; });
window.__seek=function(t){ posterVisible=false; posterEl.hidden=true; T=t; render(); };
requestAnimationFrame(frame);
}catch(err){ window.__report((err&&err.message)||String(err)); }
})();
