/* 10 — Life feeds life, T23–26. Mouse takes and chews a cap in its paws; a slug grazes a second fallen cap. */
(function(){
 'use strict';const F=window.FILM,L=F.lib,P=L.pal,ID='feast';
 function furShape(c,pts,fill,seed,count=100){
  const N=F.nature,r=L.rng(seed);
  L.inkPath(c,pts,{closed:true,fill,color:P.ink,width:3.7,seed,wobble:.8});
  c.save();c.beginPath();L.tracePath(c,pts,true);c.clip();
  let xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;
  for(let i=0;i<count;i++){
    const x=x0+r()*w,y=y0+r()*h;
    N.line(c,[[x,y],[x+3+r()*5,y+5+r()*6]],i%3?P.inkSoft:P.furLight,.8+(i%3)*.2,seed+i);
  }c.restore();
 }
 function mouse(c,tw){
  const N=F.nature,bite=tw>=1,chew=bite?Math.sin(Math.floor(tw*12)*Math.PI*.72):0,reach=L.smoothstep(0,.65,tw),handY=L.lerp(760,690,reach);
  // Long tapered tail and hind legs establish a mouse silhouette, not a rabbit.
  N.path(c,[['moveTo',603,824],['bezierCurveTo',463,832,388,760,317,809],['bezierCurveTo',215,879,268,930,431,904]],null,P.ink,18);
  N.path(c,[['moveTo',603,824],['bezierCurveTo',463,832,388,760,317,809],['bezierCurveTo',215,879,268,930,431,904]],null,P.duskRose,12);
  for(let i=0;i<10;i++)N.line(c,[[319+i*10,813-i*.7],[324+i*10,823-i*.9]],P.inkSoft,.8,400+i);
  furShape(c,[[518,830],[508,745],[542,643],[600,581],[674,576],[755,614],[809,689],[826,779],[786,846],[691,870],[578,864]],P.fur,321,250);
  N.path(c,[['moveTo',702,619],['bezierCurveTo',769,647,806,702,795,815],['quadraticCurveTo',777,850,718,856],['quadraticCurveTo',738,728,702,619]],P.furLight,P.inkSoft,1.5);
  N.ellipse(c,591,854,82,30,P.fur,P.ink,3,-.15);
  N.ellipse(c,759,858,87,25,P.furLight,P.ink,3,.03);
  for(let i=0;i<4;i++)N.line(c,[[791+i*13,849],[796+i*12,868]],P.inkSoft,1,510+i);
  // Both round ears remain visible, with tissue hatching.
  N.ellipse(c,763,514,64,80,P.fur,P.ink,4,-.15);
  N.ellipse(c,763,518,41,54,P.duskRose,P.inkSoft,1.5,-.15);
  N.ellipse(c,862,491,59,75,P.fur,P.ink,4,.22);
  N.ellipse(c,862,493,36,51,P.duskRose,P.inkSoft,1.4,.22);
  for(let i=0;i<8;i++)N.line(c,[[843+i*5,456],[850+i*4,513]],P.inkSoft,.6,610+i);
  c.save();c.translate(0,chew*1.7);
  furShape(c,[[720,554],[762,530],[843,534],[901,554],[930,591],[999,624],[1011,651],[989,670],[930,683],[882,721],[812,705],[746,656],[714,600]],P.fur,421,170);
  // Cheek light and shaded mobile lower jaw.
  N.path(c,[['moveTo',944,636],['quadraticCurveTo',904,635,870,674],['quadraticCurveTo',910,707,969,676+chew*3],['quadraticCurveTo',991,667,987,651]],P.furLight,P.inkSoft,1.3);
  N.ellipse(c,879,587,15,20,P.ink,P.ink,1,-.22);
  N.ellipse(c,875,580,4,5,P.white,null);
  N.ellipse(c,1002,643,12,9,P.metalDeep,P.ink,1);
  N.line(c,[[992,654],[982,665],[970,665+chew*3]],P.ink,2,733);
  // Three clear whiskers each side, kept fine against the heavier muzzle edge.
  for(let i=0;i<3;i++){
    N.path(c,[['moveTo',963,646+i*7],['quadraticCurveTo',1023,616+i*19,1078,618+i*24]],null,P.inkSoft,1.1);
    N.path(c,[['moveTo',960,649+i*7],['quadraticCurveTo',912,621+i*21,876,626+i*29]],null,P.inkSoft,1);
  }
  c.restore();
  // Forearm reaches up: food visibly contacts the mouth on the bite beat.
  furShape(c,[[803,701],[843,695],[878,handY+9],[926,handY-19],[943,handY-2],[906,handY+30],[868,handY+56],[831,774]],P.fur,810,40);
  const capX=1022,capY=handY-22;
  c.save();c.translate(capX,capY);c.rotate(-.3);
  N.path(c,[['moveTo',-13,20],['lineTo',-4,78],['quadraticCurveTo',10,89,23,77],['lineTo',13,17]],P.gills,P.ink,2.5);
  const cap=bite?[[-90,0],[-86,-23],[-61,-42],[-36,-54],[-19,-49],[-21,-30],[-8,-20],[5,-29],[17,-23],[28,-37],[33,-45],[66,-23],[87,0],[50,22],[-24,25]]:[[-90,0],[-86,-23],[-61,-42],[-36,-54],[1,-59],[39,-44],[66,-23],[87,0],[50,22],[-24,25]];
  L.inkPath(c,cap,{closed:true,fill:P.cap,color:P.ink,width:3.2,seed:842});
  N.path(c,[['moveTo',-87,0],['quadraticCurveTo',-4,15,87,0],['quadraticCurveTo',37,40,-45,24],['closePath']],P.gills,P.inkSoft,2);
  for(let j=-8;j<=8;j++)N.path(c,[['moveTo',j*9,4],['quadraticCurveTo',j*7,23,0,30]],null,P.inkSoft,.9);
  c.restore();
  // Fingers wrap the stem from both sides rather than sitting behind the object.
  N.ellipse(c,998,handY+34,24,14,P.duskRose,P.inkSoft,2,-.3);
  for(let j=0;j<3;j++)N.line(c,[[981+j*7,handY+26],[989+j*7,handY+40]],P.inkSoft,1,875+j);
  N.ellipse(c,1035,handY+29,22,13,P.duskRose,P.inkSoft,2,.3);
  for(let j=0;j<3;j++)N.line(c,[[1024+j*7,handY+21],[1028+j*7,handY+35]],P.inkSoft,1,895+j);
  if(bite)for(let j=0;j<9;j++){
    const p=((tw-1)*.85+j*.14)%1;N.ellipse(c,991+Math.sin(j*4)*20+p*21,662+p*150,2.8,1.8,P.capDeep,null);
  }
 }
 function slug(c,tw){
  const N=F.nature,q=L.smoothstep(0,1.9,tw),xx=1350+60*q,chew=tw>2?Math.sin(tw*19)*2:0;
  c.save();c.translate(xx,858);
  N.path(c,[['moveTo',-167,24],['bezierCurveTo',-136,-2,-143,-31,-70,-37],['bezierCurveTo',-23,-41,12,-15,29,-32],['bezierCurveTo',47,-55,64,-37,68,-16],['quadraticCurveTo',93,4+chew,70,19],['bezierCurveTo',27,30,-110,40,-167,24]],P.slug,P.ink,3.4);
  N.path(c,[['moveTo',-164,26],['quadraticCurveTo',-80,33,72,18]],null,P.mossDeep,5);
  N.path(c,[['moveTo',-114,-12],['bezierCurveTo',-113,-42,-46,-37,-27,-5],['quadraticCurveTo',-51,19,-114,-12]],P.sage,P.inkSoft,1.5);
  N.line(c,[[48,-22],[48,-60],[40,-77]],P.ink,2.7,910);N.line(c,[[60,-25],[75,-58],[79,-68]],P.ink,2.5,911);
  N.ellipse(c,40,-77,4,4,P.ink,null);N.ellipse(c,79,-68,4,4,P.ink,null);
  N.line(c,[[75,5],[89,8+chew]],P.ink,2,912);
  const rr=L.rng(924);for(let i=0;i<80;i++){const x=-130+rr()*170,y=-20+rr()*36;N.ellipse(c,x,y,.8,1.5,P.mossDeep,null);}
  c.restore();
  // Low fallen cap touches the mouth. A clear scalloped bite appears at T25.
  c.save();c.translate(1517,854);c.rotate(.12);
  const pts=tw>2?[[-45,-4],[-54,-17],[-47,-31],[-33,-36],[-22,-21],[-12,-25],[-8,-39],[23,-48],[67,-31],[85,-6],[56,13],[-8,18]]:[[-57,-4],[-55,-22],[-28,-43],[23,-48],[67,-31],[85,-6],[56,13],[-8,18]];
  L.inkPath(c,pts,{closed:true,fill:P.cap,color:P.ink,width:3,seed:943});
  N.path(c,[['moveTo',-48,5],['quadraticCurveTo',24,10,84,-6],['quadraticCurveTo',62,27,-13,18]],P.gills,P.inkSoft,1.5);
  for(let j=0;j<9;j++)N.line(c,[[j*11-22,8],[22,23]],P.inkSoft,1,953+j);
  c.restore();
 }
 F.scene({id:ID,draw(c,t0,info){
  const t=L.clamp(t0,0,3),tw=L.onTwos(t),N=F.nature;
  N.forest(c,{T:info.T,ground:816,seed:91,soil:false});
  N.log(c,1160,682,520,97,{seed:71,decay:.8,T:info.T});
  N.mushroom(c,1360,683,1.43,{seed:73,T:info.T,lean:.07});N.mushroom(c,1543,695,.9,{seed:74,T:info.T,lean:.25});
  N.fern(c,1740,930,1.0,-1,91);mouse(c,tw);slug(c,tw);
  N.moss(c,1100,941,510,{seed:239});N.leaf(c,1094,936,.65,1.2,{seed:400});
  // A short amber trail connects consumed fungal tissue to the animal, then settles.
  if(t>1){c.save();c.globalAlpha=.7*(1-L.clamp((t-2.4)/.6));c.strokeStyle=P.annYellow;c.lineWidth=2;c.setLineDash([3,10]);
    c.beginPath();c.moveTo(1070,700);c.bezierCurveTo(1090,539,796,457,750,667);c.stroke();
    for(let i=0;i<3;i++){const q=L.clamp((t-1-i*.1)/1.1);const x=1050-300*q,y=697-180*Math.sin(q*Math.PI);N.ellipse(c,x,y,3,3,P.nutrient,null);}c.restore();}
 }});
})();
