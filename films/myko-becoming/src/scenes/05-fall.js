/* 05 — What the forest gives, T10–12. Forest depth; falling fruit; dry leaves; snapped dead branch; dormant fungal body below soil. */
(function(){
 'use strict';const F=window.FILM,L=F.lib,P=L.pal,ID='fall';
 F.scene({id:ID,draw(c,t0,info){
  const t=L.clamp(t0,0,2),tw=L.onTwos(t),N=F.nature;
  N.forest(c,{T:info.T,ground:725,seed:91,soil:true});
  // Quiescent mycelium is already present; fruiting bodies are only part of the fungus.
  c.save();c.globalAlpha=.50;N.rootweb(c,100,900,1710,122,1,{seed:217,color:P.gills});c.restore();
  const fall=(a,b,start,end)=>L.lerp(start,end,L.ease.inQuad(L.clamp((tw-a)/(b-a))));
  const fruitY=fall(0,.5,40,747)+(tw>.5&&tw<.8?-24*Math.sin((tw-.5)/.3*Math.PI):0);
  N.fruit(c,620,fruitY,1.27,{seed:37,T:info.T,rotation:-.13*L.clamp(tw/.5)});
  const branchY=fall(.25,1,20,749);
  N.branch(c,1265,branchY,1.54,L.lerp(-.6,.1,L.clamp((tw-.25)/.75)),{seed:64});
  for(let i=0;i<5;i++){
    const p=L.clamp((tw-(.18+i*.1))/(.72+i*.07)),x=800+i*80+Math.sin(p*4+i)*46,y=L.lerp(-100-i*50,780+(i%2)*40,L.ease.inOutSine(p));
    N.leaf(c,x,y,.66+(i%3)*.17,p*2.3+i,{seed:103+i});
  }
  // Interrupted pen trajectories explain the different falling beats.
  c.save();c.globalAlpha=.35;c.setLineDash([6,10]);c.strokeStyle=P.annBlue;c.lineWidth=2;
  c.beginPath();c.moveTo(565,135);c.quadraticCurveTo(555,420,575,650);c.stroke();
  c.beginPath();c.moveTo(1480,210);c.quadraticCurveTo(1530,430,1475,660);c.stroke();c.restore();
  N.rings(c,620,793,L.clamp((t-.5)/.4));N.rings(c,1265,781,L.clamp((t-1)/.4),P.annBlue);
  // Small crumbs displaced by impact, not a smoke explosion.
  for(let k=0;k<14;k++){
    const p=L.clamp((tw-.5)/.4),a=k*2.4;
    if(p>0&&p<1){c.save();c.globalAlpha=1-p;N.ellipse(c,620+Math.cos(a)*135*p,790-Math.sin(k)*35*p-42*Math.sin(p*Math.PI),2.5,1.7,P.earth,null);c.restore();}
  }
 }});
})();
