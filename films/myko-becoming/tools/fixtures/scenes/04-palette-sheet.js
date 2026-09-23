// Each named swatch appears on both plates at the landscape film's actual size.
FILM.scene({id:'palette',draw(ctx,t,info){
 const L=info.lib,P=L.pal,names=Object.keys(P).filter(k=>typeof P[k]==='string'&&/^#/.test(P[k]));
 const per=12,pages=Math.ceil(names.length/per),page=Math.min(pages-1,Math.floor(t/info.dur*pages));
 L.paper(ctx,{seed:4});ctx.save();ctx.beginPath();ctx.rect(960,0,960,1080);ctx.clip();L.blueprint(ctx,{seed:6});ctx.restore();
 for(let plate=0;plate<2;plate++){
  const offset=plate*960,color=plate?P.lineWhite:P.ink;
  L.text(ctx,`${plate?'Blueprint':'Paper'} · Palette ${page+1}/${pages}`,offset+70,90,{size:32,color});
  names.slice(page*per,page*per+per).forEach((name,i)=>{
   const x=offset+70+i%4*210,y=160+Math.floor(i/4)*290;
   ctx.fillStyle=P[name];ctx.fillRect(x,y,150,145);
   L.inkPath(ctx,[[x,y],[x+150,y],[x+150,y+145],[x,y+145]],{closed:true,color,width:1.5,seed:i});
   L.text(ctx,name,x,y+178,{size:22,color});L.text(ctx,P[name],x,y+205,{size:19,color,alpha:.65});
  });
 }
}});
