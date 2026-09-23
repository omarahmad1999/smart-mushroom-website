/* Spores leave gills, settle on damp material, then germinate — never in mid-air. */
(function(){
  'use strict';
  const TAU=Math.PI*2;
  function cycle(ctx,L,P,stage) {
    for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3;ctx.beginPath();ctx.arc(1750,170,42,a+.15,a+TAU/3-.15);ctx.strokeStyle=L.rgba(i===stage?P.hypha:P.lavender,i===stage?.85:.22);ctx.lineWidth=i===stage?3:1.5;ctx.stroke();const x=1750+42*Math.cos(a+TAU/3-.15),y=170+42*Math.sin(a+TAU/3-.15);ctx.beginPath();ctx.arc(x,y,i===stage?3.6:2,0,TAU);ctx.fillStyle=i===stage?P.hypha:P.lavender;ctx.fill();}
  }
  const cubic=(a,b,c,d,u)=>{const v=1-u;return[v*v*v*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u*u*u*d[0],v*v*v*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u*u*u*d[1]];};
  function stroke(ctx,pts,color,width,alpha=1,p=1){
    ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const f=Math.max(1,(pts.length-1)*Math.min(1,p)),n=Math.floor(f);ctx.moveTo(...pts[0]);for(let i=1;i<=n;i++)ctx.lineTo(...pts[i]);if(n<pts.length-1){const u=f-n;ctx.lineTo(pts[n][0]+(pts[n+1][0]-pts[n][0])*u,pts[n][1]+(pts[n+1][1]-pts[n][1])*u);}ctx.stroke();ctx.restore();
  }
  function spore(ctx,x,y,s,L,P,rot=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
    L.inkPath(ctx,[[12,-3],[6,-9],[-6,-9],[-12,-4],[-11,5],[-3,10],[8,7]],{closed:true,fill:P.navyLight,width:1.8,color:P.lavender,seed:1101,wobble:.5,tremble:.1,boilAmp:.25});
    ctx.beginPath();ctx.ellipse(0,0,5,3.5,.2,0,TAU);ctx.strokeStyle=P.hypha;ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(2,0,1.8,0,TAU);ctx.fillStyle=P.glow;ctx.fill();ctx.restore();
  }
  let branches;
  function germGeometry(L){
    if(branches)return branches;
    const r=L.rng('spore-germination'),out=[];
    const tips=[[758,533],[817,414],[953,332],[1120,393],[1174,559],[1100,699],[920,748],[783,666]];
    tips.forEach((end,j)=>{
      const angle=Math.atan2(end[1]-540,end[0]-960);
      const c1=[960+Math.cos(angle+.5)*55,540+Math.sin(angle+.5)*55],c2=[end[0]-Math.cos(angle)*64,end[1]-Math.sin(angle)*64];
      const pts=Array.from({length:28},(_,i)=>cubic([960,548],c1,c2,end,i/27));
      out.push({pts,w:4.4,start:.01+j*.015});
      for(let k=8;k<26;k+=4){
        const s=pts[k],a=angle+(k%3?1:-1)*r.range(.45,1.3),len=r.range(25,55),e=[s[0]+Math.cos(a)*len,s[1]+Math.sin(a)*len];
        if(Math.hypot(e[0]-960,e[1]-540)>228)continue;
        const pp=Array.from({length:12},(_,i)=>cubic(s,[s[0]+Math.cos(a-.5)*len*.3,s[1]+Math.sin(a-.5)*len*.3],[e[0]-Math.cos(a)*len*.2,e[1]-Math.sin(a)*len*.2],e,i/11));
        out.push({pts:pp,w:2,start:.2+k/100+j*.01});
        const ss=pp[7],aa=a+.65;out.push({pts:[ss,[ss[0]+Math.cos(aa)*13,ss[1]+Math.sin(aa)*13],[ss[0]+Math.cos(aa+.2)*27,ss[1]+Math.sin(aa+.2)*27]],w:1.2,start:.48+j*.01});
      }
    });
    return branches=out;
  }
  FILM.scene({id:'spores',draw(ctx,t,info){
    const L=info.lib,P=L.pal,tw=L.onTwos(Math.min(t,2)),isolate=L.seg(t,1.35,1.85,'inOutSine');
    // 1. The same microscopic plate anchors the three scenes.
    L.blueprint(ctx,{seed:71,center:[960,540],circles:3,diagonals:2,grid:60});
    ctx.save();ctx.globalAlpha=1-isolate*.92;
    // 2. An etched mushroom underside, with densely fanned lamellae.
    const stem=[[489,323],[494,420],[445,567],[353,654],[367,682],[414,667],[514,554],[563,410],[552,326]];
    L.inkPath(ctx,stem,{closed:true,fill:P.navyDeep,width:2.5,color:P.lavender,alpha:.8,seed:1110,wobble:2,double:true});
    for(let j=0;j<10;j++)L.inkPath(ctx,[[496+j*4,358],[493+j*3,463],[447+j*3,565],[373+j*3,660]],{width:1,color:P.lavender,alpha:.25,seed:1120+j,wobble:1.2});
    const outline=L.ellipsePts(530,259,422,168,96,-.2);
    L.inkPath(ctx,outline,{closed:true,fill:P.navyLight,width:4.2,color:P.hyphaPale,alpha:.96,seed:1130,wobble:3,double:{offset:9,width:1.3,alpha:.6}});
    ctx.save();ctx.beginPath();L.tracePath(ctx,outline);ctx.clip();
    const rr=L.rng('mushroom-gills');
    for(let j=0;j<98;j++){
      const a=j/98*TAU,rx=Math.cos(a)*415,ry=Math.sin(a)*163,ca=Math.cos(-.2),sa=Math.sin(-.2),end=[530+rx*ca-ry*sa,259+rx*sa+ry*ca];
      const start=[524+Math.cos(a)*38,297+Math.sin(a)*20];
      const path=Array.from({length:18},(_,i)=>cubic(start,[start[0]+(end[0]-start[0])*.25,start[1]+(end[1]-start[1])*.5+25],[end[0]-(end[0]-start[0])*.25,end[1]+9],end,i/17));
      stroke(ctx,path,j%4?P.lavender:P.hypha,j%4?1.25:2,.28+rr()*.3);
      if(j%2===0){const pt=path[13];ctx.beginPath();ctx.arc(pt[0],pt[1],1.5,0,TAU);ctx.fillStyle=L.rgba(P.hypha,.65);ctx.fill();}
    }
    ctx.restore();
    L.inkPath(ctx,L.ellipsePts(525,294,44,23,40,-.2),{closed:true,width:1.6,color:P.lavender,alpha:.62,seed:1131,wobble:1});
    // 3. A damp chip of wood: clear landing surface, broken fibres, droplets.
    const bark=[[790,547],[926,531],[1035,557],[1188,561],[1402,611],[1478,664],[1383,725],[1144,701],[928,656],[789,593]];
    L.inkPath(ctx,bark,{closed:true,fill:P.navyDeep,width:2.6,color:P.lavender,alpha:.8,seed:1140,wobble:3,double:true});
    for(let j=0;j<18;j++){
      const y=555+j*7;
      L.inkPath(ctx,[[815,y],[963,y-8],[1067,y+17],[1211,y+19],[1420,y+61]],{width:j%5?1:1.8,color:P.lavender,alpha:.19+j%4*.06,seed:1150+j,wobble:2.5});
    }
    for(let j=0;j<7;j++){
      const x=883+j*67,y=557+(j%3)*13+j*7;
      ctx.beginPath();ctx.ellipse(x,y,8+j%3*3,4+j%2*2,-.2,0,TAU);ctx.strokeStyle=L.rgba(P.hypha,.62);ctx.lineWidth=1.3;ctx.stroke();ctx.beginPath();ctx.arc(x-3,y-2,1.5,0,TAU);ctx.fillStyle=P.hypha;ctx.fill();
    }
    // 4. Falling spores curve in air; the selected one lands at the G1 centre.
    for(let j=0;j<25;j++){
      const release=j*.035,age=tw-release;if(age<0)continue;
      const a=[430+(j%7)*66,354+(j%3)*10],d=[700+(j%8)*63,520+(j%5)*16],u=L.clamp(age/1.4),p=cubic(a,[a[0]+90,a[1]+130],[d[0]-140,d[1]-50],d,u);
      if(u<1)spore(ctx,...p,.38+(j%3)*.11,L,P,age*.7+j);
    }
    const wind=Array.from({length:30},(_,j)=>cubic([608,361],[703,513],[848,450],[960,540],j/29));
    ctx.save();ctx.setLineDash([4,10]);stroke(ctx,wind,P.lavender,1,.25);ctx.restore();
    const travel=L.seg(tw,.08,.92,'inOutSine'),hero=cubic([608,361],[703,513],[848,450],[960,540],travel);
    if(tw<1.18)spore(ctx,...hero,1.6,L,P,travel*.7);
    ctx.restore();
    // 5. The landing becomes a microscopic cross-section, contained in the exact eye circle.
    const lens=L.seg(t,1.02,1.55,'outCubic');
    if(lens>0){
      ctx.save();ctx.globalAlpha=lens;ctx.beginPath();ctx.arc(960,540,240,0,TAU);ctx.clip();
      ctx.fillStyle=L.rgba(P.navyDeep,.88*isolate);ctx.fillRect(715,295,490,490);
      // Faint plant walls establish that the branching germ tube is inside substrate.
      for(let row=0;row<7;row++)for(let col=0;col<5;col++){
        const x=730+col*105+(row%2)*25,y=314+row*74;
        const pts=[[x,y+12],[x+80,y],[x+111,y+42],[x+78,y+64],[x+6,y+70]];
        L.inkPath(ctx,pts,{closed:true,width:1,color:P.lavender,alpha:.16,seed:1300+row*5+col,wobble:3});
      }
      const growth=L.seg(tw,1.08,1.75,'outCubic');
      for(const b of germGeometry(L)){
        const p=L.clamp((growth-b.start)/(1-b.start));
        if(p<=0)continue;
        stroke(ctx,b.pts,P.hypha,b.w,.85,p);
        if(b.w>2){const f=p*(b.pts.length-1),j=Math.floor(f),a=b.pts[j],bb=b.pts[Math.min(j+1,b.pts.length-1)],x=L.lerp(a[0],bb[0],f-j),y=L.lerp(a[1],bb[1],f-j);L.glowDot(ctx,x,y,2.3,{color:P.hypha,rays:0,glow:5,intensity:.7,seed:j});}
      }
      spore(ctx,960,540,1.7,L,P,.7);
      ctx.restore();
      // Screen-fixed geometry: no camera transform may move this shared match cut.
      L.guideCircle(ctx,960,540,240,{color:P.hyphaPale,alpha:lens*.95,width:4});
      L.guideCircle(ctx,960,540,231,{color:P.lavender,alpha:lens*.4,width:1.2});
    }
    const hit=L.seg(t,.92,1.22);
    if(t>=.92&&hit<1)L.guideCircle(ctx,960,540,15+hit*42,{color:P.magenta,width:2,alpha:(1-hit)*.7});
    cycle(ctx,L,P,2);
  }});
})();
