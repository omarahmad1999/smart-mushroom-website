const page=document.querySelector<HTMLElement>('[data-about-page]');
if(page){
  const myko=page.querySelector<HTMLElement>('[data-myko]')!,stage=myko.querySelector<HTMLElement>('.myko-stage')!;
  const symbol=myko.querySelector<HTMLElement>('[data-emotion-symbol]')!,hint=myko.querySelector<HTMLElement>('[data-myko-hint]')!,say=myko.querySelector<HTMLElement>('[data-myko-say]')!;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let motion=!reduced.matches,visible=true,locked=false,kind='';
  let idleTwo:number|undefined,idleFour:number|undefined,reaction:number|undefined,blink:number|undefined,blinkEnd:number|undefined;
  let pointer:{x:number;y:number}|undefined;
  const symbols:Record<string,string>={neutral:'',happy:'〃',curious:'?',melancholic:'…',sleepy:'Zzz',surprised:'!!',dizzy:'@',squint:'!',peek:''};
  const labels:Record<string,string>={neutral:'Myko · say hello',happy:'A little hello back.',curious:'Oh? What’s that?',melancholic:'Still there…?',sleepy:'Just resting my eyes.',surprised:'Oh! You’re back!',dizzy:'Whoa… it’s all spinning.',squint:'Hey!',peek:'…you’re sneaky.',crossed:'That’s… very close.'};
  // Each click says the next line; after the first hello the rest loop.
  const sequence:[string,string][]=[['happy','Hi! I’m Myko.'],['happy','Hehe, that tickles!'],['curious','The mushrooms grew on me.'],['happy','Small explorer, big world.'],['curious','Fungi connect worlds.']];
  let told=0,movedAt=0,sneaked=0,approached=false,hovering=false;const clicks:number[]=[],pending:number[]=[];
  // Tap spots in the 1254px image: centre x, centre y, radius x, radius y.
  const caps=[[616,88,160,72],[478,205,58,36],[812,205,84,50],[876,305,66,44]],visor=[502,442,136,140],pack=[945,630,68,180];
  const spots:Record<string,[string,string][]>={cap:[['curious','Ooh, spores!'],['happy','Make a wish!'],['curious','They’ll grow somewhere nice.']],visor:[['squint','Hey! That’s my visor.'],['squint','Now it’s all smudgy.']],pack:[['happy','My field kit!'],['curious','Sample jars and a notebook.'],['happy','No snacks in there. Sadly.']]};
  const said:Record<string,number>={cap:0,visor:0,pack:0};
  const spores=stage.querySelector<HTMLElement>('[data-myko-spores]')!,dream=stage.querySelector<HTMLElement>('[data-myko-dream]')!,dreams=['mushroom','pi','peacock'];
  let dreamt=0,dreaming:number|undefined,drift:Animation|undefined;
  function toImage(x:number,y:number){const rect=stage.getBoundingClientRect();return{x:(x-rect.left)/rect.width*1254,y:(y-rect.top)/rect.height*1254};}
  const within=([cx,cy,rx,ry]:number[],point:{x:number;y:number})=>((point.x-cx)/rx)**2+((point.y-cy)/ry)**2<=1;
  function gaze(){if(!motion||!pointer||locked||myko.dataset.mood!=='neutral')return;aim(pointer.x,pointer.y);}
  // Looks at a point in the image, for reactions that hold the gaze.
  function look(x:number,y:number){if(!motion)return;const rect=stage.getBoundingClientRect();aim(rect.left+rect.width*x/1254,rect.top+rect.height*y/1254);}
  function aim(x:number,y:number){
    const rect=stage.getBoundingClientRect();
    const dx=x-(rect.left+rect.width*478.8/1254),dy=y-(rect.top+rect.height*449.5/1254);
    const distance=Math.hypot(dx,dy),reach=Math.tanh(distance/(rect.width*.3));
    // Preserve the cursor's angle at every distance; independent clamping flattened far-away directions.
    myko.style.setProperty('--eye-x',`${distance?dx/distance*reach*26:0}px`);
    myko.style.setProperty('--eye-y',`${distance?dy/distance*reach*45:0}px`);
  }
  function mood(value:string,line=labels[value],mark=symbols[value]){myko.dataset.mood=value;myko.dataset.tracking=String(value==='neutral'&&motion&&!locked);symbol.textContent=mark;hint.textContent=line;if(value==='sleepy')dreamOn();else dreamOff();if(value==='neutral'){gaze();cross();}else myko.removeAttribute('data-crossed');}
  // A mouse resting on the visor makes Myko cross-eyed; touches never hover, so they skip it.
  function cross(){const on=hovering&&!!pointer&&!locked&&myko.dataset.mood==='neutral'&&within(visor,toImage(pointer.x,pointer.y)),was=myko.hasAttribute('data-crossed');myko.toggleAttribute('data-crossed',on);if(on)hint.textContent=labels.crossed;else if(was)hint.textContent=labels.neutral;}
  // Dreams start once the Zzz has shown for a moment, then a new doodle drifts up every 3.4 seconds.
  function dreamOn(){
    clearTimeout(dreaming);
    dreaming=window.setTimeout(function next(){
      dream.dataset.dream=dreams[dreamt++%dreams.length];drift?.cancel();
      if(motion)drift=dream.animate([{opacity:0,transform:'translateY(8px) scale(.9)'},{opacity:1,transform:'none',offset:.2},{opacity:1,transform:'translateY(-4px)',offset:.8},{opacity:0,transform:'translateY(-9px)'}],{duration:3200,easing:'ease-in-out',fill:'both'});
      dreaming=window.setTimeout(next,3400);
    },1400);
  }
  function dreamOff(){clearTimeout(dreaming);drift?.cancel();delete dream.dataset.dream;}
  function clearIdle(){clearTimeout(idleTwo);clearTimeout(idleFour);}
  function idle(){clearIdle();if(!visible||document.hidden)return;idleTwo=window.setTimeout(()=>{if(!locked)mood('melancholic');},2000);idleFour=window.setTimeout(()=>{if(!locked){sneaked=0;approached=false;mood('sleepy');}},4000);}

  type Reaction={line?:string;mark?:string;duration?:number;type?:string;then?:()=>void};
  // A reaction holds the face for its duration; `then` chains the next reaction instead of returning to neutral.
  function later(run:()=>void,delay:number){pending.push(window.setTimeout(run,delay));}
  function react(value:string,{line,mark,duration=2000,type='wake',then}:Reaction={}){clearTimeout(reaction);pending.splice(0).forEach(clearTimeout);clearIdle();locked=true;kind=type;mood(value,line,mark);reaction=window.setTimeout(()=>{if(then)return then();locked=false;kind='';mood('neutral');idle();},duration);}
  function speak(value:string,line:string,mark?:string){react(value,{line,mark,duration:2400,type:'click'});say.textContent=line;}
  // Five clicks inside 2.5 seconds make Myko dizzy; he ignores clicks until he has recovered.
  function spin(){const now=performance.now();clicks.push(now);while(now-clicks[0]>2500)clicks.shift();if(clicks.length<5)return false;clicks.length=0;say.textContent=labels.dizzy;react('dizzy',{duration:2400,type:'dizzy',then:()=>react('melancholic',{line:'Okay, okay…',duration:3000,type:'dizzy'})});return true;}
  function tell(){const [value,line]=sequence[told<sequence.length?told:1+(told-1)%(sequence.length-1)];told++;speak(value,line);}
  function quip(spot:string){const lines=spots[spot],[value,line]=lines[said[spot]++%lines.length];speak(value,line);}
  // Spores drift up from the gills under the tapped cap, and Myko's eyes follow them.
  function puff([cx,cy,rx,ry]:number[]){
    quip('cap');if(!motion)return;
    const under=cy+ry*.55,scale=stage.getBoundingClientRect().width/1254;
    look(cx,under);later(()=>look(cx,under-300),500);later(()=>look(cx+60,under-650),1100);
    for(let i=0;i<14;i++){
      const dot=document.createElement('i'),size=3+Math.random()*4,dx=(Math.random()-.5)*rx*1.4*scale,rise=(250+Math.random()*350)*scale;
      dot.style.cssText=`left:${(cx+(Math.random()-.5)*rx*1.2)/12.54}%;top:${under/12.54}%;width:${size}px;height:${size}px`;
      spores.append(dot);
      const done=()=>dot.remove();
      dot.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:`translate(calc(-50% + ${dx*.3}px),calc(-50% - ${rise*.25}px)) scale(1)`,opacity:1,offset:.2},{transform:`translate(calc(-50% + ${dx}px),calc(-50% - ${rise}px)) scale(.7)`,opacity:0}],{duration:1500+Math.random()*900,delay:Math.random()*250,easing:'ease-out',fill:'both'}).finished.then(done,done);
    }
  }
  // Creeping slower than 120px a second keeps Myko asleep; the first move after a pause counts as one short frame.
  // A creep that starts off his visor, covers 30px and ends on it wakes one eye.
  function creep(from:{x:number;y:number},to:{x:number;y:number},elapsed:number){
    const step=Math.hypot(to.x-from.x,to.y-from.y);if(step/Math.min(Math.max(elapsed,8),40)*1000>120)return false;
    if(!within(visor,toImage(from.x,from.y)))approached=true;
    sneaked+=step;if(approached&&sneaked>=30&&within(visor,toImage(to.x,to.y))){if(motion)aim(to.x,to.y);say.textContent=labels.peek;react('peek',{duration:2600});}
    return true;
  }
  function active(event?:PointerEvent){
    const from=pointer,now=performance.now(),elapsed=now-movedAt;
    if(event){pointer={x:event.clientX,y:event.clientY};hovering=event.pointerType!=='touch';if(event.type==='pointermove')movedAt=now;}
    if(!visible||document.hidden)return;if(locked)return;const current=myko.dataset.mood;
    if(current==='sleepy'){if(event?.type==='pointermove'&&from&&creep(from,pointer!,elapsed))return;react('surprised');}
    else if(current==='melancholic')react('curious');else{gaze();cross();idle();}
  }
  document.addEventListener('pointermove',active);document.addEventListener('pointerdown',active);document.addEventListener('keydown',()=>active());
  stage.addEventListener('click',event=>{
    if(kind==='dizzy'||spin())return;
    // Keyboard clicks have no position, so they tell the running sequence.
    const point=event.detail?toImage(event.clientX,event.clientY):undefined,cap=point&&caps.find(spot=>within(spot,point));
    if(cap)puff(cap);else if(point&&within(visor,point))quip('visor');else if(point&&within(pack,point))quip('pack');else tell();
  });
  function sync(){clearTimeout(blink);clearTimeout(blinkEnd);clearIdle();clearTimeout(reaction);pending.splice(0).forEach(clearTimeout);locked=false;kind='';myko.removeAttribute('data-blinking');myko.toggleAttribute('data-animate',motion&&visible&&!document.hidden);myko.style.setProperty('--eye-x','0px');myko.style.setProperty('--eye-y','0px');mood('neutral');if(visible&&!document.hidden){idle();scheduleBlink();}}
  function scheduleBlink(){if(!motion||!visible||document.hidden)return;blink=window.setTimeout(()=>{if(myko.dataset.mood==='neutral'){myko.setAttribute('data-blinking','');blinkEnd=window.setTimeout(()=>myko.removeAttribute('data-blinking'),120);}scheduleBlink();},3300);}
  reduced.addEventListener('change',()=>{motion=!reduced.matches;sync();});document.addEventListener('visibilitychange',()=>{sync();});
  new IntersectionObserver(entries=>{const next=entries[0].isIntersecting;if(next!==visible){visible=next;if(visible&&locked){myko.toggleAttribute('data-animate',motion);scheduleBlink();}else sync();}},{threshold:.1}).observe(myko);
  const tabs=[...page.querySelectorAll<HTMLButtonElement>('[data-story]')],panels=[...page.querySelectorAll<HTMLElement>('[data-story-page]')];let animation:Animation|undefined;
  function select(index:number,interact=true){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});panels.forEach((panel,i)=>panel.hidden=i!==index);animation?.cancel();if(interact&&motion)animation=panels[index].animate([{opacity:.3},{opacity:1}],{duration:200});}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index));tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(next);tabs[next].focus();});});panels.forEach((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tabs[i].id);});page.querySelector<HTMLElement>('.story-tabs')!.hidden=false;select(0,false);page.dataset.aboutReady='true';sync();
}
