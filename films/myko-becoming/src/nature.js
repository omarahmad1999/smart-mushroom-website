/* Reusable, hand-inked forest forms. All geometry is authored or seeded; poses depend on supplied time only. */
(function () {
  'use strict';
  const F = window.FILM, L = F.lib, P = L.pal, TAU = Math.PI * 2;
  const clamp = L.clamp;
  let frozenPlate = false;
  function ink(c,points,options) { L.inkPath(c,points,Object.assign({},options,frozenPlate?{boil:false}:{})); }
  function path(c, data, fill, stroke = P.ink, width = 3) {
    c.beginPath();
    for (const s of data) c[s[0]](...s.slice(1));
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = stroke; c.stroke(); }
  }
  function ellipse(c,x,y,rx,ry,fill,stroke=P.ink,width=3,rot=0) {
    c.beginPath(); c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rot,0,TAU);
    if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}
  }
  function line(c, pts, color=P.inkSoft, width=1.5, seed=1) {
    const b=frozenPlate?0:L.boil(L.T);
    c.beginPath(); c.lineCap='round'; c.lineJoin='round';c.strokeStyle=color;
    c.lineWidth=width*(.92+.15*L.h3(seed,5,31));
    const jitter=(i)=>frozenPlate?0:(L.h3(seed,i,b)-.5)*.7;
    c.moveTo(pts[0][0]+jitter(0),pts[0][1]+jitter(1));
    for(let i=1;i<pts.length;i++) {
      const a=pts[i-1],z=pts[i],dx=z[0]-a[0],dy=z[1]-a[1],j=(L.h3(seed,i,8)-.5)*1.4;
      c.quadraticCurveTo((a[0]+z[0])/2-dy*.01+j,(a[1]+z[1])/2+dx*.01+j,z[0]+jitter(i*2),z[1]+jitter(i*2+1));
    }
    c.stroke();
  }
  function clippedHatch(c, shape, bounds, seed, color=P.inkSoft, spacing=8, angle=-.7, alpha=.45) {
    c.save(); c.globalAlpha*=alpha;
    L.hatch(c,shape,{bounds,seed,color,spacing,angle,width:1.35,jitter:1.3,boil:frozenPlate?false:undefined}); c.restore();
  }
  function leaf(c,x,y,s=1,rot=0,o={}) {
    const sd=L.hash('leaf',o.seed||0), r=L.rng(sd);
    c.save(); c.translate(x,y); c.rotate(rot); c.scale(s,s);
    const pts=[[0,4],[-35,-14],[-68,-62],[-53,-104],[-14,-128],[26,-103],[50,-67],[38,-31]];
    ink(c,pts,{closed:true,fill:o.color||P.leafGold,color:P.inkSoft,width:2.2,seed:sd,wobble:.8});
    clippedHatch(c,pts,[-70,-130,120,140],sd+2,P.inkSoft,7,-.6,.30);
    line(c,[[0,19],[-4,-17],[-15,-57],[-14,-115]],P.inkSoft,2.4,sd+3);
    for(let i=0;i<7;i++){
      const yy=-14-i*13, xx=-2-i*1.8;
      line(c,[[xx,yy],[xx-16-i*2,yy-7],[xx-27-i*2,yy-17]],P.inkSoft,1,sd+i+4);
      line(c,[[xx,yy],[xx+17+i,yy-11],[xx+31-i*2,yy-24]],P.inkSoft,1,sd+i+18);
    }
    // A curled tip exposes the paler reverse of a dry leaf.
    path(c,[['moveTo',-14,-128],['quadraticCurveTo',8,-137,27,-106],['quadraticCurveTo',5,-115,-14,-128]],P.paperShade,P.inkSoft,1.3);
    for(let i=0;i<12;i++){let xx=r()*75-45,yy=-r()*97;ellipse(c,xx,yy,1,1,P.inkSoft,null);}
    c.restore();
  }
  function moss(c,x,y,width,o={}) {
    const sd=L.hash('moss',o.seed||0),r=L.rng(sd); c.save();
    for(let i=0;i<Math.max(12,width/7);i++){
      const xx=x+r()*width, yy=y+r()*15, h=8+r()*24;
      const col=[P.moss,P.mossDeep,P.mossLight][i%3];
      line(c,[[xx-6,yy],[xx-6-r()*4,yy-h*.6],[xx,yy-h],[xx+4,yy-h*.3],[xx+9,yy]],col,3,sd+i);
      if(i%3===0){line(c,[[xx,yy],[xx-2,yy-h-8]],P.mossDeep,1.2,sd+i+91);}
    } c.restore();
  }
  function fern(c,x,y,s=1,flip=1,seed=1){
    c.save();c.translate(x,y);c.scale(s*flip,s);
    line(c,[[0,0],[5,-55],[28,-129],[68,-196],[116,-229]],P.mossDeep,3,seed);
    for(let j=0;j<15;j++){
      const p=j/15, xx=116*p*p, yy=-230*p, span=42*Math.sin(p*Math.PI)+6;
      const ang=-.48+p*.7;
      for(const side of [-1,1]){
        c.save(); c.translate(xx,yy);c.rotate(ang);
        path(c,[['moveTo',0,0],['quadraticCurveTo',side*span*.65,-26,side*span,-26],['quadraticCurveTo',side*span*.7,-2,0,0]],j%2?P.moss:P.sage,P.mossDeep,.9);
        line(c,[[0,0],[side*span,-25]],P.mossDeep,.8,seed+j*4+side);
        c.restore();
      }
    }c.restore();
  }
  function log(c,x,y,w,h,o={}){
    const sd=L.hash('log',o.seed||0),r=L.rng(sd),d=clamp(o.decay||0);
    c.save();c.translate(x,y);c.rotate(o.rotation||0);
    const outline=[[0,12],[w*.12,-4],[w*.28,9-d*5],[w*.52,-8],[w*.77,5],[w,-3],[w+25,h*.3],[w+15,h*.78],[w-10,h],[w*.68,h+5],[w*.44,h-5],[w*.18,h+9],[-14,h-5]];
    ink(c,outline,{closed:true,fill:d>.5?P.earth:P.wood,color:P.ink,width:4.5,seed:sd,wobble:1.15});
    c.save();c.beginPath();L.tracePath(c,outline,true);c.clip();
    for(let i=0;i<48;i++){
      let yy=i*h/48+r()*5; const pts=[];
      for(let j=0;j<=12;j++) pts.push([j*w/12,yy+Math.sin(j*.84+i)*4+r()*2]);
      line(c,pts,i%5===0?P.earthDeep:P.inkSoft,i%5===0?2.4:.95,sd+i);
    }
    for(let j=0;j<11;j++){
      const xx=r()*w,yy=r()*h;
      line(c,[[xx,yy],[xx+20,yy-8],[xx+38,yy-4],[xx+62,yy-13],[xx+91,yy-11]],P.earthDeep,2,sd+j+900);
      if(j%2===0) line(c,[[xx+22,yy-7],[xx+31,yy+7],[xx+52,yy+9]],P.earthDeep,1.2,sd+j+800);
    }
    for(let k=0;k<5;k++){
      const xx=w*(.12+k*.185),yy=h*(.2+(k%3)*.22);
      for(let j=0;j<5;j++) ellipse(c,xx,yy,14+j*8,4+j*3,null,P.earthDeep,j===0?2:1,.04);
    }
    // Rot opens irregular fissures rather than moving the log as a rigid object.
    if(d>0){
      c.globalAlpha=d;
      for(let j=0;j<9;j++){
        const xx=w*(.04+j*.113),yy=h*(.2+(j%3)*.25);
        line(c,[[xx,yy],[xx+22,yy+7],[xx+45,yy-6],[xx+70,yy+6],[xx+100,yy+4]],P.earthDeep,3+5*d,sd+j+77);
      }
      c.globalAlpha=1;
    }
    c.restore();
    // Saw-like broken end, with visible concentric growth rings.
    const end=[[-14,9],[11,-4],[25,11],[37,h*.25],[31,h*.7],[8,h+7],[-15,h-4],[-25,h*.6]];
    ink(c,end,{closed:true,fill:P.tan,color:P.ink,width:3,seed:sd+66});
    for(let j=0;j<5;j++) ellipse(c,7,h*.5,5+j*4,9+j*h*.065,null,P.inkSoft,1.1);
    line(c,[[6,h*.5],[-10,h*.24]],P.inkSoft,2,sd+61);
    if(o.moss!==false){moss(c,w*.4,2,w*.43,{seed:sd});moss(c,w*.03,4,w*.17,{seed:sd+4});}
    c.restore();
  }
  function mushroom(c,x,y,s=1,o={}){
    const sd=L.hash('mushroom',o.seed||0),growth=clamp(o.growth===undefined?1:o.growth),open=L.smoothstep(.24,.93,growth);
    const h=20+137*growth,w=13+98*open,yy=-h;
    c.save();c.translate(x,y);c.rotate(o.lean||0);c.scale(s,s);
    // Tapered stem with visible longitudinal fibres.
    path(c,[['moveTo',-13,4],['bezierCurveTo',-18,-h*.28,4,-h*.68,-11,yy+9],['lineTo',15,yy+9],['bezierCurveTo',30,-h*.65,11,-h*.22,17,5],['quadraticCurveTo',1,12,-13,4]],P.gills,P.ink,3);
    for(let i=0;i<6;i++)line(c,[[-8+i*4,1],[-4+i*4,-h*.36],[1+i*3,-h*.66],[-3+i*3,yy+15]],i>3?P.inkSoft:P.tan,i>3?1.2:.8,sd+i);
    const cap=[[-w,yy+11],[-w*.93,yy-10-open*18],[-w*.62,yy-33-open*16],[-w*.22,yy-47-open*3],[w*.22,yy-43],[w*.66,yy-26],[w,yy+8],[w*.8,yy+23],[w*.25,yy+28],[-w*.38,yy+24]];
    ink(c,cap,{closed:true,fill:o.capColor||P.cap,color:P.ink,width:3.5,seed:sd+100,wobble:1});
    // Underside is a visible curved crescent, with converging lamellae.
    const gill=[[-w,yy+10],[-w*.65,yy+12],[-w*.15,yy+4],[w*.34,yy+9],[w,yy+8],[w*.75,yy+29],[w*.2,yy+39],[-w*.4,yy+32],[-w*.82,yy+24]];
    ink(c,gill,{closed:true,fill:P.gills,color:P.inkSoft,width:2,seed:sd+101,wobble:.65});
    c.save(); c.beginPath();L.tracePath(c,gill,true);c.clip();
    for(let j=-18;j<=18;j++){
      const xx=j/18*w;
      path(c,[['moveTo',xx,yy+12+7*Math.sin(j*.4)],['quadraticCurveTo',xx*.72,yy+35,4,yy+46]],null,P.inkSoft,1);
    }c.restore();
    c.save();c.beginPath();L.tracePath(c,cap,true);c.clip();
    for(let j=0;j<14;j++){
      const xx=-w*.8+j*w*1.6/14;
      path(c,[['moveTo',xx,yy+6],['quadraticCurveTo',xx*.9,yy-12,xx*.67,yy-31]],null,P.capDeep,1.1);
    }
    const r=L.rng(sd+9);
    for(let i=0;i<36;i++){
      const xx=(r()*2-1)*w, yy2=yy-45+r()*55;
      ellipse(c,xx,yy2,1.5+r()*2,.7+r(),P.capLight,null,-.2);
    }
    c.restore();
    // Slightly broken second ink edge produces the printed, handmade rim.
    line(c,[[-w*.9,yy+6],[-w*.58,yy+7],[-w*.14,yy],[w*.31,yy+5],[w*.87,yy+4]],P.capLight,2,sd+130);
    c.restore();
  }
  function fruit(c,x,y,s=1,o={}){
    const sd=L.hash('fruit',o.seed||0),d=clamp(o.decay||0),r=L.rng(sd);
    c.save();c.translate(x,y);c.rotate(o.rotation||0);c.scale(s*(1+d*.1),s*(1-d*.48));
    const pts=[[0,-101],[-37,-112],[-83,-80],[-91,-31],[-69,14],[-24,39],[5,31],[31,38],[75,9],[86,-42],[65,-91],[31,-108]];
    ink(c,pts,{closed:true,fill:d>.55?P.earth:P.fruitSkin,color:P.ink,width:3.5,seed:sd,wobble:.9+d});
    c.save();c.beginPath();L.tracePath(c,pts,true);c.clip();
    for(let i=0;i<14;i++){
      const xx=15+i*7;
      path(c,[['moveTo',xx,-96],['bezierCurveTo',xx+34,-35,xx+14,18,xx-21,38]],null,P.inkSoft,1.1);
    }
    for(let i=0;i<90;i++)ellipse(c,r()*185-95,r()*158-115,r()<d?2.7:1,1,P.inkSoft,null);
    if(d>.15)for(let j=0;j<6;j++){
      const xx=-65+j*24,yy=-58+(j%2)*31;
      path(c,[['moveTo',xx,yy],['lineTo',xx+14,yy-12*d],['lineTo',xx+24,yy+12],['lineTo',xx+40,yy+8]],null,P.earthDeep,1+d*4);
    }
    c.restore();
    line(c,[[0,-99],[-2,-121],[9,-140]],P.earthDeep,6,sd+2);
    leaf(c,8,-130,.34,.85,{seed:sd+4,color:d>.5?P.leafGold:P.moss});
    path(c,[['moveTo',-65,-55],['quadraticCurveTo',-72,-76,-51,-83]],null,P.fruitFlesh,4);
    c.restore();
  }
  function branch(c,x,y,s=1,rot=0,o={}){
    const sd=L.hash('branch',o.seed||1);c.save();c.translate(x,y);c.rotate(rot);c.scale(s,s);
    const pts=[[-194,14],[-200,-6],[-157,-12],[-93,-4],[-56,-30],[-26,-87],[-7,-95],[1,-79],[-32,-16],[21,-1],[81,-17],[147,-7],[188,-27],[201,-16],[181,7],[113,20],[47,18],[-24,27],[-74,20],[-145,25]];
    ink(c,pts,{closed:true,fill:P.wood,color:P.ink,width:3,seed:sd,wobble:1});
    for(let j=0;j<7;j++)line(c,[[-185,5+j*3],[-106,5+j*2],[-46,-6+j*3],[19,5+j*2],[93,4+j*2],[180,-8+j*2]],P.earthDeep,1,sd+j);
    for(let j=0;j<4;j++)line(c,[[-39+j*4,-16],[-23+j*4,-52],[-10+j*3,-83]],P.earthDeep,1,sd+j+10);
    ellipse(c,-194,6,5,11,P.tan,P.inkSoft,1.2);
    c.restore();
  }
  function hypha(c,points,progress=1,o={}){
    const sd=L.hash('hypha',o.seed||0),col=o.color||P.hyphaPale;
    if(progress<=0)return;
    const n=(points.length-1)*clamp(progress),whole=Math.floor(n),pts=points.slice(0,whole+1);
    if(whole<points.length-1){const f=n-whole;pts.push([L.lerp(points[whole][0],points[whole+1][0],f),L.lerp(points[whole][1],points[whole+1][1],f)]);}
    if(pts.length>1){line(c,pts,P.earthDeep,(o.width||2)+2,sd);line(c,pts,col,o.width||2,sd);}
  }
  function rootweb(c,x,y,width,height,progress=1,o={}){
    const sd=L.hash('rootweb',o.seed||0),r=L.rng(sd);
    for(let k=0;k<13;k++){
      const yy=y+k*height/13,pts=[];
      for(let j=0;j<11;j++)pts.push([x+j*width/10,yy+Math.sin(j*1.3+k)*13+r()*12]);
      const p=clamp(progress*1.55-k*.045);
      hypha(c,pts,p,{seed:sd+k,color:o.color,width:1.5});
      for(let j=1;j<8;j+=2){
        const xx=x+j*width/10,yyy=pts[j][1];
        hypha(c,[[xx,yyy],[xx+24,yyy-16],[xx+42,yyy-38],[xx+56,yyy-40]],clamp((p-j/10)*5),{seed:sd+k*44+j,color:o.color,width:1.1});
      }
    }
  }
  function drawForest(c,o={}){
    const seed=o.seed||91,ground=o.ground||780,T=o.T||0;
    L.paper(c,{seed:151,color:P.paper,grain:.03});
    // Three planes of trunks, each much paler than the foreground subjects.
    const r=L.rng(L.hash('forest',seed));
    c.save();
    for(let layer=0;layer<3;layer++){
      c.globalAlpha=[.15,.21,.40][layer];
      for(let i=0;i<7;i++){
        const xx=-90+i*335+r()*130,wide=34+layer*25+r()*32,by=ground-130+layer*52;
        const points=[[xx-wide,by],[xx-wide*.36,by*.53],[xx-wide*.27,-50],[xx+wide*.32,-50],[xx+wide*.52,by*.5],[xx+wide,by]];
        ink(c,points,{closed:true,fill:layer===2?P.tan:P.sage,color:P.inkFaint,width:2,seed:seed+layer*14+i,wobble:.6});
        for(let j=0;j<7;j++){
          const yy=80+j*87+r()*20,side=j%2?1:-1;
          line(c,[[xx,yy],[xx+side*(70+layer*15),yy-65],[xx+side*(115+layer*20),yy-165]],P.inkFaint,5-j*.35,seed+i*99+j);
          line(c,[[xx-wide*.27+j*wide*.08,by],[xx-wide*.17+j*wide*.055,by*.6],[xx-wide*.15+j*wide*.052,-40]],P.inkFaint,1,seed+i*9+j);
        }
      }
    }
    c.restore();
    c.fillStyle=P.paperShade;c.beginPath();c.moveTo(0,ground-10);c.bezierCurveTo(370,ground-80,1120,ground+35,1920,ground-45);c.lineTo(1920,1080);c.lineTo(0,1080);c.closePath();c.fill();
    if(o.soil!==false){
      path(c,[['moveTo',0,ground+110],['bezierCurveTo',460,ground+80,1250,ground+160,1920,ground+95],['lineTo',1920,1080],['lineTo',0,1080],['closePath']],P.earth,P.inkSoft,2);
      const rr=L.rng(L.hash(seed,'soil'));c.save();c.globalAlpha=.48;
      for(let i=0;i<650;i++){
        const xx=rr()*1920,yy=ground+105+rr()*(1080-ground-90);
        line(c,[[xx,yy],[xx+3+rr()*12,yy-2-rr()*4]],i%3?P.earthDeep:P.tan,.7+rr(),seed+i*3);
      }c.restore();
    }
    const rr=L.rng(L.hash(seed,'litter'));
    for(let i=0;i<35;i++){
      const xx=rr()*1920,yy=ground-8+rr()*145;
      if(i%3===0)leaf(c,xx,yy,.15+rr()*.3,rr()*6,{seed:seed+i});
      else line(c,[[xx,yy],[xx+15,yy-3],[xx+35,yy+2]],P.inkFaint,1,seed+i);
    }
    fern(c,45,ground+89,1.18,1,seed+88);fern(c,1850,ground+50,1.13,-1,seed+89);
    moss(c,80,ground+36,150,{seed:seed+31});moss(c,1650,ground+24,170,{seed:seed+32});
  }
  function forest(c,o={}){
    const key='myko-forest-v2-'+(o.seed||91)+'-'+(o.ground||780)+'-'+(o.soil!==false);
    const plate=L.cached(key,()=>{
      const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
      frozenPlate=true;
      try{drawForest(canvas.getContext('2d'),o);}finally{frozenPlate=false;}
      return canvas;
    });
    c.drawImage(plate,0,0,1920,1080);
  }
  function rings(c,x,y,p,color=P.annYellow){
    if(p<=0||p>=1)return;c.save();c.globalAlpha=1-p;
    for(let i=0;i<2;i++){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(x,y,24+110*p+i*20,6+26*p+i*6,0,0,TAU);c.stroke();}c.restore();
  }
  F.nature=Object.freeze({forest,log,mushroom,leaf,moss,fern,fruit,branch,hypha,rootweb,rings,path,ellipse,line});
})();
