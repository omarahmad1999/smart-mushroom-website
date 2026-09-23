/* 06 — A hidden appetite, T12–15. Damp litter, branching hyphae, collapsing fruit, opening bark fissures, restrained passage-of-time arcs. */
(function(){
 'use strict';const F=window.FILM,L=F.lib,P=L.pal,ID='colonize';
 F.scene({id:ID,draw(c,t0,info){
  const t=L.clamp(t0,0,3),tw=L.onTwos(t),N=F.nature,g=L.smoothstep(.2,2.5,tw),decay=L.smoothstep(1.1,2.7,tw);
  N.forest(c,{T:info.T,ground:756,seed:91,soil:true});
  // Closer, lower viewpoint keeps the decomposition readable.
  N.log(c,760,665,640,120,{seed:64,decay,T:info.T,rotation:.02,moss:false});
  N.fruit(c,490,795,1.8,{seed:37,decay,T:info.T,rotation:-.13});
  for(let i=0;i<5;i++)N.leaf(c,650+i*95,804+(i%2)*28,.65+i*.07,1.3+i*.5,{seed:103+i});
  N.rootweb(c,130,911,1630,124,.34+.66*g,{seed:217});
  // Threads move continuously up through the soil and bifurcate around organic matter.
  const roots=[
    [[220,942],[285,887],[390,857],[457,811],[470,734],[431,690]],
    [[440,970],[540,900],[580,852],[536,810],[520,736],[492,715]],
    [[590,914],[666,871],[740,827],[825,780],[888,739],[982,708],[1090,701],[1280,718]],
    [[910,977],[972,902],[1050,844],[1080,795],[1160,758],[1250,727],[1390,699]],
    [[1500,954],[1435,868],[1341,825],[1250,789],[1145,775]],
    [[740,827],[725,774],[759,749],[789,712],[861,679]],
    [[1050,844],[1011,795],[966,767],[925,741]],
    [[390,857],[348,830],[328,786],[360,724]],
  ];
  for(let i=0;i<roots.length;i++){
    N.hypha(c,roots[i],L.clamp(g*1.45-(i%3)*.08),{seed:209+i,width:3.5});
    const pts=roots[i];
    for(let j=1;j<pts.length-1;j++){
      let [x,y]=pts[j],d=(j%2?1:-1);
      N.hypha(c,[[x,y],[x+d*20,y-18],[x+d*37,y-29],[x+d*48,y-50]],L.clamp(g*1.65-j*.09-.15),{seed:300+i*8+j,width:1.7});
    }
  }
  // Small structures loosen as fibres are digested, remaining as litter and soil.
  for(let i=0;i<9;i++){
    const p=L.clamp((tw-1.6-i*.04)/.55);if(!p)continue;
    N.ellipse(c,830+i*63,798+p*(24+(i%3)*7),4+2*(i%2),2.4,P.earthDeep,null);
  }
  // Day / night arcs communicate compressed time without numbers or labels.
  c.save();c.strokeStyle=P.annYellow;c.lineWidth=2;c.globalAlpha=.65;
  c.beginPath();c.arc(1580,300,93,Math.PI*.9,Math.PI*2.1);c.stroke();
  const a=Math.PI+.95*Math.PI*L.clamp(t/2.7),sx=1580+Math.cos(a)*93,sy=300+Math.sin(a)*93;
  N.ellipse(c,sx,sy,12,12,P.sun,P.ochre,1.5);
  for(let j=0;j<8;j++){const r=j*Math.PI/4;N.line(c,[[sx+Math.cos(r)*17,sy+Math.sin(r)*17],[sx+Math.cos(r)*24,sy+Math.sin(r)*24]],P.ochre,1,55+j);}
  N.ellipse(c,1665,336,14,14,P.paperShade,P.inkFaint,1.5);N.ellipse(c,1672,331,11,12,P.paper,null);c.restore();
  // Fine spore/air motes leave the center calm and the illustration alive.
  for(let i=0;i<17;i++){
    const x=180+(i*151)%1560,y=470+(i*47)%215+Math.sin(tw*1.3+i)*4;
    N.ellipse(c,x,y,1.5,2.2,P.inkFaint,null);
  }
 }});
})();
