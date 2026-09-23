/* The fungus digests outside its body, then absorbs the smaller molecules. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const tube = [[-90,725],[125,655],[340,647],[485,568],[604,475],[702,404],[813,375],[855,388],[854,420],[808,444],[738,472],[647,548],[628,576],[758,564],[875,565],[912,590],[903,622],[842,645],[713,651],[627,685],[703,759],[765,819],[766,851],[738,876],[701,862],[617,807],[532,739],[444,728],[307,764],[155,759],[-85,841]];
  const seams = [
    [[-30,772],[151,707],[327,710],[478,650],[599,544],[722,439],[829,403]],
    [[478,650],[630,617],[766,607],[888,602]],
    [[515,665],[607,752],[740,842]],
  ];
  const tips = [[846,404],[899,601],[747,850]];
  const target = [[1170,332],[1302,540],[1122,795]];
  const curve = (a,b,u,bend=0) => [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u+Math.sin(u*Math.PI)*bend];
  function line(ctx, pts, color, width, alpha=1) {
    ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.restore();
  }
  // Shared microscopic cycle glyph: fixed position and geometry on all three plates.
  function cycle(ctx,L,P,stage) {
    for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3;ctx.beginPath();ctx.arc(1750,170,42,a+.15,a+TAU/3-.15);ctx.strokeStyle=L.rgba(i===stage?P.hypha:P.lavender,i===stage?.85:.22);ctx.lineWidth=i===stage?3:1.5;ctx.stroke();const x=1750+42*Math.cos(a+TAU/3-.15),y=170+42*Math.sin(a+TAU/3-.15);ctx.beginPath();ctx.arc(x,y,i===stage?3.6:2,0,TAU);ctx.fillStyle=i===stage?P.hypha:P.lavender;ctx.fill();}
  }
  function hex(ctx,x,y,r,P,alpha,rot=0) {
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha*=alpha;ctx.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.strokeStyle=P;ctx.lineWidth=3.7;ctx.stroke();ctx.beginPath();ctx.arc(0,0,2,0,TAU);ctx.fillStyle=P;ctx.fill();ctx.restore();
  }
  function enzyme(ctx,x,y,ang,L,P,seed){
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.strokeStyle=P.hyphaPale;ctx.lineWidth=4;ctx.fillStyle=P.navyLight;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*TAU;const r=19+5*Math.cos(a*3);const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();L.glowDot(ctx,-2,-1,5.2,{color:P.hypha,rays:0,glow:5,intensity:.65,seed});ctx.restore();
  }
  FILM.scene({id:'digest',draw(ctx,t,info){
    const L=info.lib,P=L.pal,tw=L.onTwos(Math.min(t,3));
    // 1. Engraved microscopy plate and ghosted organic-cell structure.
    L.blueprint(ctx,{seed:71,center:[960,540],circles:3,diagonals:2,grid:60});
    const rr=L.rng('digest-granules');
    for(let i=0;i<190;i++){const x=rr.range(40,1880),y=rr.range(170,970),r=rr.range(.8,2.7);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=L.rgba(P.lavender,rr.range(.08,.28));ctx.fill();}
    for(let j=0;j<5;j++){
      const x=1260+j*130,y=250+Math.sin(j*1.9)*35;
      L.inkPath(ctx,[[x-105,y-30],[x-54,y-75],[x+55,y-64],[x+87,y+60],[x+79,y+206],[x+95,y+395],[x+28,y+483],[x-73,y+446],[x-101,y+221]],{closed:true,width:1.6,color:P.lavender,alpha:.18,seed:450+j,wobble:4});
    }
    // 2. A continuous, membrane-bounded branching hypha with cytoplasmic detail.
    L.inkPath(ctx,tube,{closed:true,fill:P.navyLight,color:P.hyphaPale,width:5.4,alpha:1,seed:712,wobble:2.4,double:{width:1.2,offset:8,alpha:.4}});
    ctx.save();ctx.beginPath();L.tracePath(ctx,tube);ctx.clip();
    const organelles=L.rng('hypha-cytoplasm');
    for(let i=0;i<160;i++){
      const x=organelles.range(-80,920),y=organelles.range(380,870),r=organelles.range(1.2,3.5);
      ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=L.rgba(P.hypha,.17+organelles()*.16);ctx.fill();
    }
    for(let i=0;i<12;i++){
      const x=60+i*57,y=715-i*23+Math.sin(i)*27;
      ctx.beginPath();ctx.ellipse(x,y,16+i%3*7,9+i%2*7,-.3,0,TAU);ctx.strokeStyle=L.rgba(P.lavender,.54);ctx.lineWidth=1.3;ctx.stroke();
      if(i%3===0)L.glowDot(ctx,x,y,3.5,{color:P.hypha,rays:0,glow:5,intensity:.6,seed:100+i});
    }
    for(let i=0;i<44;i++){
      const x=i*22-40,y=760-Math.max(0,x-240)*.35;
      line(ctx,[[x,y+10],[x+30,y-17]],P.lavender,1,.15);
    }
    ctx.restore();
    seams.forEach((pts,i)=>L.inkPath(ctx,pts,{width:1.2,color:P.hypha,alpha:.28,seed:720+i,wobble:1.4}));
    // Septal walls leave a pore for transport.
    [[[210,656],[230,758]],[[440,596],[492,720]],[[656,444],[710,478]]].forEach((s)=>{
      const [a,b]=s,m=curve(a,b,.5);line(ctx,[a,curve(a,b,.43)],P.lavender,1.8,.6);line(ctx,[curve(a,b,.58),b],P.lavender,1.8,.6);L.guideCircle(ctx,m[0],m[1],6,{alpha:.5,color:P.hypha});
    });
    // 3. Organic chains outside the fungus: bonds break before freed units move.
    for(let row=0;row<3;row++){
      const anchor=target[row],breakAt=1+row*.125,breakP=L.seg(tw,breakAt,breakAt+.25,'outQuad');
      for(let j=0;j<9;j++){
        const x=anchor[0]+j*61,y=anchor[1]+(j%2?27:-5)+Math.sin(row+j*.55)*8;
        const detached=j<2&&tw>breakAt;
        if(!detached){
          hex(ctx,x,y,24,P.hyphaPale,.96,-.16+row*.08);
          if(j<8){const nx=anchor[0]+(j+1)*61,ny=anchor[1]+((j+1)%2?27:-5)+Math.sin(row+(j+1)*.55)*8;line(ctx,[[x+21,y],[nx-21,ny]],j<2?P.hypha:P.hyphaPale,2.7,j<2?1-breakP:.72);}
        }
      }
      // Small fragments curve through the membrane into the hyphal lumen.
      for(let unit=0;unit<2;unit++){
        const start=[anchor[0]+unit*61,anchor[1]+(unit%2?27:-5)+Math.sin(row+unit*.55)*8];
        if(tw<breakAt)continue;
        const arrival=2+row*.12+unit*.16,q=L.seg(tw,breakAt+.18,arrival,'inOutSine');
        const end=[tips[row][0]-125-unit*56,tips[row][1]+(row===0?55:row===2?-60:7)];
        const xy=curve(start,end,q,row===2?-62:40);
        const rad=L.lerp(21,6,L.seg(tw,breakAt,breakAt+.2));
        hex(ctx,...xy,rad,P.nutrient,1,-.1+q*1.2);
        L.glowDot(ctx,...xy,7.5,{color:P.nutrient,core:P.glow,rays:0,glow:5,intensity:.95,seed:800+row*3+unit});
      }
      // Cyan enzymes leave tips first; magenta flashes mark bond cleavage.
      for(let k=0;k<2;k++){
        const q=L.seg(tw,.125+row*.125+k*.1,1+row*.125,'inOutSine');
        const xy=curve(tips[row],[anchor[0]+32+k*16,anchor[1]+8],q,-25+row*22);
        if(tw>=.125+row*.125+k*.1&&tw<1.6+row*.1){ctx.save();ctx.globalAlpha=1-L.seg(tw,1.3+row*.125,1.6+row*.125);enzyme(ctx,...xy,q*3+k,L,P,920+row+k);ctx.restore();}
      }
      const f=L.seg(t,breakAt,breakAt+.35);
      if(t>=breakAt&&f<1){L.guideCircle(ctx,anchor[0]+29,anchor[1]+7,8+f*43,{alpha:(1-f)*.85,width:2,color:P.magenta});}
    }
    // 4. Restrained measuring marks establish microscopic scale without labels.
    L.bracket(ctx,247,886,624,886,{color:P.lavender,alpha:.38});
    L.ticks(ctx,1590,550,{r:242,n:42,len:7,major:7,majorLen:16,color:P.lavender,alpha:.3,width:1});
    cycle(ctx,L,P,0);
  }});
})();
