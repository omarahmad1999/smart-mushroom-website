/* A connected fungal body channels absorbed nutrients toward a fruiting knot. */
(function(){
  'use strict';
  const TAU=Math.PI*2;
  function cycle(ctx,L,P,stage) {
    for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3;ctx.beginPath();ctx.arc(1750,170,42,a+.15,a+TAU/3-.15);ctx.strokeStyle=L.rgba(i===stage?P.hypha:P.lavender,i===stage?.85:.22);ctx.lineWidth=i===stage?3:1.5;ctx.stroke();const x=1750+42*Math.cos(a+TAU/3-.15),y=170+42*Math.sin(a+TAU/3-.15);ctx.beginPath();ctx.arc(x,y,i===stage?3.6:2,0,TAU);ctx.fillStyle=i===stage?P.hypha:P.lavender;ctx.fill();}
  }
  const cubic=(a,b,c,d,u)=>{const v=1-u;return[v*v*v*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u*u*u*d[0],v*v*v*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u*u*u*d[1]];};
  let geometry;
  function tree(L){
    if(geometry)return geometry;
    const r=L.rng('the-hidden-fungal-body'),paths=[],main=[];
    const origin=[1070,448];
    const ends=[[128,778],[402,549],[515,1002],[902,961],[1300,964],[1790,899],[1630,683],[1375,547]];
    ends.forEach((e,i)=>{
      const c1=[origin[0]+(e[0]-origin[0])*.22,580+r.range(-30,40)],c2=[e[0]+r.range(-80,80),e[1]-90];
      const pts=Array.from({length:41},(_,k)=>cubic(origin,c1,c2,e,k/40));
      const entry={pts,width:8-i*.26,alpha:.96,id:i};paths.push(entry);main.push(entry);
      for(let j=6;j<39;j+=4){
        const start=pts[j],next=pts[j+1],theta=Math.atan2(next[1]-start[1],next[0]-start[0])+(j%3?1:-1)*r.range(.5,1.2),length=r.range(100,230),end=[start[0]+Math.cos(theta)*length,start[1]+Math.sin(theta)*length*.75];
        const branch=Array.from({length:21},(_,k)=>cubic(start,[start[0]+Math.cos(theta-.4)*length*.3,start[1]+Math.sin(theta-.4)*length*.3],[end[0]-Math.cos(theta+.3)*length*.22,end[1]-Math.sin(theta+.3)*length*.22],end,k/20));
        paths.push({pts:branch,width:3.6,alpha:.85,id:i*10+j});
        for(let q=5;q<20;q+=5){
          const s=branch[q],a=theta+r.range(-1.3,1.3),len=r.range(40,95),en=[s[0]+Math.cos(a)*len,s[1]+Math.sin(a)*len];
          const branchlet=Array.from({length:11},(_,k)=>cubic(s,[s[0]+Math.cos(a-.5)*len*.4,s[1]+Math.sin(a-.5)*len*.4],[en[0]-Math.cos(a)*len*.2,en[1]-Math.sin(a)*len*.2],en,k/10));
          paths.push({pts:branchlet,width:1.7,alpha:.68,id:i*100+j*4+q});
          const tinyStart=branchlet[7],ta=a+(q%2?-.8:.8);paths.push({pts:[tinyStart,[tinyStart[0]+Math.cos(ta)*20,tinyStart[1]+Math.sin(ta)*20],[tinyStart[0]+Math.cos(ta+.2)*38,tinyStart[1]+Math.sin(ta+.2)*38]],width:1.2,alpha:.46,id:i*1000+j*5+q});
        }
      }
    });
    return geometry={paths,main};
  }
  function stroke(ctx,pts,width,color,alpha=1,offset=0){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha*=alpha;ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]+offset):ctx.moveTo(p[0],p[1]+offset));ctx.stroke();ctx.restore();
  }
  FILM.scene({id:'network',draw(ctx,t,info){
    const L=info.lib,P=L.pal,tw=L.onTwos(Math.min(t,2)),g=tree(L);
    // 1. A slow camera pull reveals the scale of the organism beneath the litter.
    L.blueprint(ctx,{seed:71,center:[960,540],circles:3,diagonals:2,grid:60});
    const zoom=L.lerp(1.42,1,L.seg(t,0,1.5,'outCubic'));
    ctx.save();ctx.translate(960,540);ctx.scale(zoom,zoom);ctx.translate(-1000,-598);
    // 2. Dead wood in cross-section and delicate soil aggregates.
    const log=[[198,367],[302,303],[552,297],[790,335],[970,307],[1189,332],[1370,376],[1377,438],[1196,455],[967,415],[770,434],[563,409],[324,443],[201,417]];
    L.inkPath(ctx,log,{closed:true,fill:P.navyDeep,color:P.lavender,width:2.5,alpha:.66,seed:810,wobble:3,double:true});
    for(let k=0;k<14;k++){
      const y=319+k*8;
      const pts=Array.from({length:13},(_,j)=>[252+j*88,y+Math.sin(j*1.3+k*.2)*14+j*1.7]);
      L.inkPath(ctx,pts,{width:k%4===0?1.6:1,color:P.lavender,alpha:.15+k%3*.05,seed:820+k,wobble:2.3});
    }
    for(let k=0;k<6;k++){
      ctx.beginPath();ctx.ellipse(225,378,12+k*7,8+k*5,.35,0,TAU);ctx.strokeStyle=L.rgba(P.lavender,.27);ctx.lineWidth=1.3;ctx.stroke();
    }
    const rr=L.rng('soil-aggregates');
    for(let i=0;i<95;i++){
      const x=rr.range(55,1900),y=rr.range(475,1030),r=rr.range(8,36),shape=[];
      for(let k=0;k<7;k++){const a=k/7*TAU,rad=r*rr.range(.65,1.2);shape.push([x+Math.cos(a)*rad,y+Math.sin(a)*rad*.65]);}
      ctx.beginPath();L.tracePath(ctx,shape);ctx.strokeStyle=L.rgba(P.lavender,.08+rr()*.1);ctx.lineWidth=.8;ctx.stroke();
      if(i%4===0){ctx.beginPath();ctx.ellipse(x,y,r*.6,r*.3,.2,0,TAU);ctx.stroke();}
    }
    // 3. Hundreds of gently curving fine branches, continuous into the dense knot.
    for(const branch of g.paths){
      const wobble=Math.sin(branch.id*3.1+L.boil(info.T))*.65;
      if(branch.width>3){stroke(ctx,branch.pts,branch.width+1.8,P.hyphaPale,branch.alpha,wobble);stroke(ctx,branch.pts,branch.width-1.4,P.navyLight,.96,wobble);stroke(ctx,branch.pts,1.7,P.hypha,.83,wobble);}
      else stroke(ctx,branch.pts,branch.width,P.hypha,branch.alpha,wobble);
    }
    // 4. Absorbed nutrients travel inside the cords toward the primordium.
    for(let j=0;j<g.main.length;j++){
      const b=g.main[j];
      for(let k=0;k<3;k++){
        const u=1-((tw*.58+k*.31+j*.093)%1),f=u*(b.pts.length-1),i=Math.floor(f),a=b.pts[i],bb=b.pts[Math.min(i+1,b.pts.length-1)],x=L.lerp(a[0],bb[0],f-i),y=L.lerp(a[1],bb[1],f-i);
        L.glowDot(ctx,x,y,5.1,{color:P.nutrient,core:P.glow,rays:0,glow:6,intensity:.9,seed:j*3+k});
      }
    }
    // 5. The connected primordium: many strands gather, no floating growth.
    const bud=L.seg(tw,.5,1.55,'outCubic');
    for(let j=0;j<36;j++){
      const a=j/36*TAU,r=31+Math.sin(j*2.1)*8;
      const pts=[[1070+Math.cos(a)*r*1.2,460+Math.sin(a)*13],[1070+Math.cos(a)*r*.6,439-Math.sin(a)*9],[1070+Math.cos(a)*r*.45,414-bud*43+Math.sin(a)*r*.7]];
      L.inkPath(ctx,pts,{width:1.7,color:j%4?P.lavender:P.hypha,alpha:.66,seed:900+j,wobble:1,step:4});
    }
    const knot=[[1044,445],[1038,411-bud*34],[1047,398-bud*42],[1072,394-bud*42],[1091,402-bud*38],[1097,437],[1084,452]];
    L.inkPath(ctx,knot,{closed:true,width:2.3,color:P.lavender,alpha:.9,seed:990,wobble:1.4});
    L.glowDot(ctx,1068,418-bud*22,6+bud*3,{color:P.hypha,core:P.glow,rays:0,glow:7,intensity:.7,seed:99});
    // 6. Nearby seedling roots and soil nutrients remain separate from the fungal web.
    L.inkPath(ctx,[[1642,350],[1635,390],[1612,426],[1622,469],[1605,515],[1627,566]],{width:3,color:P.lavender,alpha:.8,seed:1040,wobble:2});
    const roots=[[[1615,428],[1575,443],[1558,475],[1534,504]],[[1620,461],[1667,482],[1678,520]],[[1614,500],[1588,534],[1597,572]]];
    roots.forEach((p,i)=>{L.inkPath(ctx,p,{width:1.7,color:P.lavender,alpha:.55,seed:1050+i,wobble:1});for(let k=1;k<p.length;k++)L.inkPath(ctx,[p[k],[p[k][0]+(i%2?22:-22),p[k][1]+16]],{width:.8,color:P.lavender,alpha:.38,seed:1070+i*4+k});});
    const leaves=[[[1640,374],[1582,360],[1549,314],[1610,325],[1640,374]],[[1640,370],[1663,321],[1720,300],[1704,342],[1640,370]]];
    leaves.forEach((p,i)=>{L.inkPath(ctx,p,{closed:true,fill:P.navyLight,width:2,color:P.lavender,alpha:.85,seed:1080+i});L.inkPath(ctx,[p[0],p[2]],{width:1,color:P.lavender,alpha:.55,seed:1090+i});});
    for(let i=0;i<9;i++){const x=1550+(i%4)*42+Math.sin(i)*14,y=500+Math.floor(i/4)*47;L.glowDot(ctx,x,y,2.3,{color:P.nutrient,rays:0,intensity:.55,glow:4,seed:1100+i});}
    ctx.restore();
    // 7. Screen-fixed microscopic cycle glyph and understated scale marks.
    L.bracket(ctx,212,920,545,920,{color:P.lavender,alpha:.27});
    cycle(ctx,L,P,1);
  }});
})();
