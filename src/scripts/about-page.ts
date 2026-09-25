const page=document.querySelector<HTMLElement>('[data-about-page]');
if(page){
  const myko=page.querySelector<HTMLElement>('[data-myko]')!,stage=myko.querySelector<HTMLElement>('.myko-stage')!;
  const symbol=myko.querySelector<HTMLElement>('[data-emotion-symbol]')!,hint=myko.querySelector<HTMLElement>('[data-myko-hint]')!,say=myko.querySelector<HTMLElement>('[data-myko-say]')!;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let motion=!reduced.matches,visible=true,locked=false,kind='';
  let idleTwo:number|undefined,idleFour:number|undefined,reaction:number|undefined,blink:number|undefined,blinkEnd:number|undefined;
  let pointer:{x:number;y:number}|undefined;
  const symbols:Record<string,string>={neutral:'',happy:'〃',curious:'?',melancholic:'…',sleepy:'Zzz',surprised:'!!',dizzy:'@'};
  const labels:Record<string,string>={neutral:'Myko · say hello',happy:'A little hello back.',curious:'Oh? What’s that?',melancholic:'Still there…?',sleepy:'Just resting my eyes.',surprised:'Oh! You’re back!',dizzy:'Whoa… it’s all spinning.'};
  // Each click says the next line; after the first hello the rest loop.
  const sequence:[string,string][]=[['happy','Hi! I’m Myko.'],['happy','Hehe, that tickles!'],['curious','The mushrooms grew on me.'],['happy','Small explorer, big world.'],['curious','Fungi connect worlds.']];
  let told=0;const clicks:number[]=[];
  function gaze(){
    if(!motion||!pointer||locked||myko.dataset.mood!=='neutral')return;
    const rect=stage.getBoundingClientRect();
    const dx=pointer.x-(rect.left+rect.width*478.8/1254),dy=pointer.y-(rect.top+rect.height*449.5/1254);
    const distance=Math.hypot(dx,dy),reach=Math.tanh(distance/(rect.width*.3));
    // Preserve the cursor's angle at every distance; independent clamping flattened far-away directions.
    myko.style.setProperty('--eye-x',`${distance?dx/distance*reach*26:0}px`);
    myko.style.setProperty('--eye-y',`${distance?dy/distance*reach*45:0}px`);
  }
  function mood(value:string,line=labels[value],mark=symbols[value]){myko.dataset.mood=value;myko.dataset.tracking=String(value==='neutral'&&motion&&!locked);symbol.textContent=mark;hint.textContent=line;if(value==='neutral')gaze();}
  function clearIdle(){clearTimeout(idleTwo);clearTimeout(idleFour);}
  function idle(){clearIdle();if(!visible||document.hidden)return;idleTwo=window.setTimeout(()=>{if(!locked)mood('melancholic');},2000);idleFour=window.setTimeout(()=>{if(!locked)mood('sleepy');},4000);}

  type Reaction={line?:string;mark?:string;duration?:number;type?:string;then?:()=>void};
  // A reaction holds the face for its duration; `then` chains the next reaction instead of returning to neutral.
  function react(value:string,{line,mark,duration=2000,type='wake',then}:Reaction={}){clearTimeout(reaction);clearIdle();locked=true;kind=type;mood(value,line,mark);reaction=window.setTimeout(()=>{if(then)return then();locked=false;kind='';mood('neutral');idle();},duration);}
  function speak(value:string,line:string,mark?:string){react(value,{line,mark,duration:2400,type:'click'});say.textContent=line;}
  // Five clicks inside 2.5 seconds make Myko dizzy; he ignores clicks until he has recovered.
  function spin(){const now=performance.now();clicks.push(now);while(now-clicks[0]>2500)clicks.shift();if(clicks.length<5)return false;clicks.length=0;say.textContent=labels.dizzy;react('dizzy',{duration:2400,type:'dizzy',then:()=>react('melancholic',{line:'Okay, okay…',duration:3000,type:'dizzy'})});return true;}
  function tell(){const [value,line]=sequence[told<sequence.length?told:1+(told-1)%(sequence.length-1)];told++;speak(value,line);}
  function active(event?:PointerEvent){if(event)pointer={x:event.clientX,y:event.clientY};if(!visible||document.hidden)return;if(locked)return;const current=myko.dataset.mood;if(current==='sleepy')react('surprised');else if(current==='melancholic')react('curious');else{gaze();idle();}}
  document.addEventListener('pointermove',active);document.addEventListener('pointerdown',active);document.addEventListener('keydown',()=>active());
  stage.addEventListener('click',()=>{if(kind==='dizzy'||spin())return;tell();});
  function sync(){clearTimeout(blink);clearTimeout(blinkEnd);clearIdle();clearTimeout(reaction);locked=false;kind='';myko.removeAttribute('data-blinking');myko.toggleAttribute('data-animate',motion&&visible&&!document.hidden);myko.style.setProperty('--eye-x','0px');myko.style.setProperty('--eye-y','0px');mood('neutral');if(visible&&!document.hidden){idle();scheduleBlink();}}
  function scheduleBlink(){if(!motion||!visible||document.hidden)return;blink=window.setTimeout(()=>{if(myko.dataset.mood==='neutral'){myko.setAttribute('data-blinking','');blinkEnd=window.setTimeout(()=>myko.removeAttribute('data-blinking'),120);}scheduleBlink();},3300);}
  reduced.addEventListener('change',()=>{motion=!reduced.matches;sync();});document.addEventListener('visibilitychange',()=>{sync();});
  new IntersectionObserver(entries=>{const next=entries[0].isIntersecting;if(next!==visible){visible=next;if(visible&&locked){myko.toggleAttribute('data-animate',motion);scheduleBlink();}else sync();}},{threshold:.1}).observe(myko);
  const tabs=[...page.querySelectorAll<HTMLButtonElement>('[data-story]')],panels=[...page.querySelectorAll<HTMLElement>('[data-story-page]')];let animation:Animation|undefined;
  function select(index:number,interact=true){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});panels.forEach((panel,i)=>panel.hidden=i!==index);animation?.cancel();if(interact&&motion)animation=panels[index].animate([{opacity:.3},{opacity:1}],{duration:200});}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index));tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(next);tabs[next].focus();});});panels.forEach((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tabs[i].id);});page.querySelector<HTMLElement>('.story-tabs')!.hidden=false;select(0,false);page.dataset.aboutReady='true';sync();
}
