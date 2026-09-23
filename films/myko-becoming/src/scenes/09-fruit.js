/* 09 — A forest rises, T20–23. Rotten wood, primordia, elongating stems, unfolding caps and lamellae. */
(function(){
 'use strict';const F=window.FILM,L=F.lib,P=L.pal,ID='fruit';
 const cluster=[{x:668,y:765,s:1.35,a:-.26,d:.45},{x:849,y:747,s:2.02,a:-.12,d:.1},{x:1044,y:748,s:2.7,a:.06,d:0},{x:1245,y:762,s:1.65,a:.25,d:.35},{x:1440,y:788,s:.98,a:.38,d:.7}];
 F.scene({id:ID,draw(c,t0,info){
  const t=L.clamp(t0,0,3),tw=L.onTwos(t),N=F.nature;
  N.forest(c,{T:info.T,ground:812,seed:91,soil:true});
  N.log(c,375,763,1160,160,{seed:71,decay:.8,T:info.T});
  c.save();c.globalAlpha=.78;N.rootweb(c,320,967,1280,95,1,{seed:217});c.restore();
  // White knots exist from the first frame, followed by discrete pin / cap stages.
  for(let i=0;i<cluster.length;i++){
    const m=cluster[i],p=L.clamp((tw-m.d)/1.7),growth=.015+.985*L.smoothstep(0,1,p);
    N.mushroom(c,m.x,m.y,m.s,{seed:71+i,growth,T:info.T,lean:m.a});
    N.moss(c,m.x-34,m.y+6,90,{seed:30+i});
  }
  N.fern(c,211,920,1.4,1,32);N.fern(c,1725,904,1.07,-1,38);
  // Morphogenesis lines arc around the main fruiting body, never replacing it.
  const q=L.clamp((t-.45)/1.5);
  c.save();c.globalAlpha=.35*q;c.strokeStyle=P.annYellow;c.lineWidth=2;
  c.beginPath();c.ellipse(1044,522,327,310,-.02,Math.PI*1.01,Math.PI*(1.01+.8*q));c.stroke();
  for(let i=0;i<5;i++){const a=Math.PI*(1.06+i*.17);const x=1044+Math.cos(a)*327,y=522+Math.sin(a)*310;N.line(c,[[x,y],[x+Math.cos(a)*15,y+Math.sin(a)*15]],P.annYellow,1.5,78+i);}c.restore();
  // Spores become apparent only after the cap has opened.
  const released=L.clamp((tw-2)/.7);
  for(let i=0;i<23;i++){
    const p=(i*.071+tw*.16)%1;
    c.save();c.globalAlpha=released*(1-p)*.65;
    N.ellipse(c,850+(i*71)%560+Math.sin(i+p*3)*28,480+p*315,2,3.3,P.gills,P.inkFaint,.6,.2);c.restore();
  }
 }});
})();
