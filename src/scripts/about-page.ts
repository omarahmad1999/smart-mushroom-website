const page=document.querySelector<HTMLElement>('[data-about-page]');
if(page){
  const myko=page.querySelector<HTMLElement>('[data-myko]')!,stage=myko.querySelector<HTMLElement>('.myko-stage')!;
  const motionButton=myko.querySelector<HTMLButtonElement>('[data-myko-motion]')!,symbol=myko.querySelector<HTMLElement>('[data-emotion-symbol]')!,hint=myko.querySelector<HTMLElement>('[data-myko-hint]')!;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let motion=!reduced.matches,visible=true,locked=false;
  let idleTwo:number|undefined,idleFour:number|undefined,reaction:number|undefined,blink:number|undefined,blinkEnd:number|undefined;
  let pointer:{x:number;y:number}|undefined;
  const symbols:Record<string,string>={neutral:'',happy:'〃',curious:'?',melancholic:'…',sleepy:'Zzz',surprised:'!!'};
  const labels:Record<string,string>={neutral:'Myko · say hello',happy:'A little hello back.',curious:'Oh? What’s that?',melancholic:'Still there…?',sleepy:'Just resting my eyes.',surprised:'Oh! You’re back!'};
  function gaze(){
    if(!motion||!pointer||locked||myko.dataset.mood!=='neutral')return;
    const rect=stage.getBoundingClientRect();
    const dx=pointer.x-(rect.left+rect.width*478.5/1254),dy=pointer.y-(rect.top+rect.height*467.5/1254);
    const distance=Math.hypot(dx,dy),reach=Math.tanh(distance/(rect.width*.3));
    // Preserve the cursor's angle at every distance; independent clamping flattened far-away directions.
    myko.style.setProperty('--eye-x',`${distance?dx/distance*reach*100:0}px`);
    myko.style.setProperty('--eye-y',`${distance?dy/distance*reach*85:0}px`);
  }
  function mood(value:string){myko.dataset.mood=value;myko.dataset.tracking=String(value==='neutral'&&motion&&!locked);symbol.textContent=symbols[value];hint.textContent=labels[value];if(value==='neutral')gaze();}
  function clearIdle(){clearTimeout(idleTwo);clearTimeout(idleFour);}
  function idle(){clearIdle();if(!visible||document.hidden)return;idleTwo=window.setTimeout(()=>{if(!locked)mood('melancholic');},2000);idleFour=window.setTimeout(()=>{if(!locked)mood('sleepy');},4000);}

  function react(value:string){clearTimeout(reaction);clearIdle();locked=true;mood(value);reaction=window.setTimeout(()=>{locked=false;mood('neutral');idle();},2000);}
  function active(event?:PointerEvent){if(event)pointer={x:event.clientX,y:event.clientY};if(!visible||document.hidden)return;if(locked)return;const current=myko.dataset.mood;if(current==='sleepy')react('surprised');else if(current==='melancholic')react('curious');else{gaze();idle();}}
  document.addEventListener('pointermove',active);document.addEventListener('pointerdown',active);document.addEventListener('keydown',()=>active());
  stage.addEventListener('click',()=>react('happy'));
  function sync(){clearTimeout(blink);clearTimeout(blinkEnd);clearIdle();clearTimeout(reaction);locked=false;myko.removeAttribute('data-blinking');myko.toggleAttribute('data-animate',motion&&visible&&!document.hidden);motionButton.setAttribute('aria-pressed',String(motion));motionButton.textContent=motion?'Motion on':'Motion off';myko.style.setProperty('--eye-x','0px');myko.style.setProperty('--eye-y','0px');mood('neutral');if(visible&&!document.hidden){idle();scheduleBlink();}}
  function scheduleBlink(){if(!motion||!visible||document.hidden)return;blink=window.setTimeout(()=>{if(myko.dataset.mood==='neutral'){myko.setAttribute('data-blinking','');blinkEnd=window.setTimeout(()=>myko.removeAttribute('data-blinking'),120);}scheduleBlink();},3300);}
  motionButton.hidden=false;motionButton.addEventListener('click',()=>{motion=!motion;sync();});reduced.addEventListener('change',()=>{motion=!reduced.matches;sync();});document.addEventListener('visibilitychange',()=>{sync();});
  new IntersectionObserver(entries=>{const next=entries[0].isIntersecting;if(next!==visible){visible=next;if(visible&&locked){myko.toggleAttribute('data-animate',motion);scheduleBlink();}else sync();}},{threshold:.1}).observe(myko);
  const tabs=[...page.querySelectorAll<HTMLButtonElement>('[data-story]')],panels=[...page.querySelectorAll<HTMLElement>('[data-story-page]')];let animation:Animation|undefined;
  function select(index:number,interact=true){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});panels.forEach((panel,i)=>panel.hidden=i!==index);animation?.cancel();if(interact&&motion)animation=panels[index].animate([{opacity:.3},{opacity:1}],{duration:200});}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index));tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(next);tabs[next].focus();});});panels.forEach((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tabs[i].id);});page.querySelector<HTMLElement>('.story-tabs')!.hidden=false;select(0,false);page.dataset.aboutReady='true';sync();
}
