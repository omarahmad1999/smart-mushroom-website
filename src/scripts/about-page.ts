const page=document.querySelector<HTMLElement>('[data-about-page]');
if(page){
  const myko=page.querySelector<HTMLElement>('[data-myko]')!,stage=myko.querySelector<HTMLElement>('.myko-stage')!,head=myko.querySelector<HTMLElement>('.myko-head-group')!;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let motion=!reduced.matches,inView=false,sleepTimer:number|undefined,blinkTimer:number|undefined,blinkEnd:number|undefined,moodTimer:number|undefined;
  const hint=myko.querySelector<HTMLElement>('[data-myko-hint]')!;
  const moodButtons=[...myko.querySelectorAll<HTMLButtonElement>('[data-myko-mood]')];
  const motionButton=myko.querySelector<HTMLButtonElement>('[data-myko-motion]')!;
  function mood(value:string){myko.dataset.mood=value;moodButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mykoMood===value)));hint.textContent=value==='happy'?'Hello, curious human.':value==='sleepy'?'Even explorers need a little rest.':value==='curious'?'There’s always something new to notice.':'Move your cursor, or tap to say hello.';}
  function resetLook(){head.style.setProperty('--tilt','0deg');head.style.setProperty('--eye-x','0px');head.style.setProperty('--eye-y','0px');}
  function idle(){clearTimeout(sleepTimer);if(motion&&inView&&!document.hidden)sleepTimer=window.setTimeout(()=>mood('sleepy'),18000);}
  function blink(){clearTimeout(blinkTimer);if(!motion||!inView||document.hidden)return;blinkTimer=window.setTimeout(()=>{if(myko.dataset.mood!=='sleepy'){myko.setAttribute('data-blinking','');blinkEnd=window.setTimeout(()=>myko.removeAttribute('data-blinking'),140);}blink();},4300);}
  function sync(){myko.toggleAttribute('data-animate',motion&&inView&&!document.hidden);motionButton.setAttribute('aria-pressed',String(motion));motionButton.textContent=motion?'Motion on':'Motion off';clearTimeout(blinkTimer);clearTimeout(blinkEnd);myko.removeAttribute('data-blinking');resetLook();blink();idle();}
  function react(value:string){clearTimeout(moodTimer);mood(value);idle();if(value!=='sleepy')moodTimer=window.setTimeout(()=>mood('neutral'),5000);}
  page.addEventListener('pointermove',event=>{if(!motion||!inView)return;if(myko.dataset.mood==='sleepy')mood('neutral');idle();const rect=stage.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-rect.left-rect.width*.52)/(rect.width*.5))),y=Math.max(-1,Math.min(1,(event.clientY-rect.top-rect.height*.36)/(rect.height*.5)));head.style.setProperty('--tilt',`${x*3}deg`);head.style.setProperty('--eye-x',`${x*rect.width*.009}px`);head.style.setProperty('--eye-y',`${y*rect.width*.006}px`);});
  page.addEventListener('pointerleave',resetLook);
  stage.addEventListener('click',()=>react('happy'));moodButtons.forEach(button=>button.addEventListener('click',()=>react(button.dataset.mykoMood!)));
  motionButton.addEventListener('click',()=>{motion=!motion;sync();});reduced.addEventListener('change',()=>{motion=!reduced.matches;sync();});document.addEventListener('visibilitychange',sync);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.1}).observe(myko);
  myko.querySelector<HTMLElement>('.myko-controls')!.hidden=false;
  const tabs=[...page.querySelectorAll<HTMLButtonElement>('[data-story]')],panels=[...page.querySelectorAll<HTMLElement>('[data-story-page]')];
  let animation:Animation|undefined;
  function select(index:number,interact=true){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});panels.forEach((panel,i)=>panel.hidden=i!==index);animation?.cancel();if(interact){react(tabs[index].dataset.expression!);if(motion)animation=panels[index].animate([{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});}}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index));tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(next);tabs[next].focus();});});
  panels.forEach((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tabs[i].id);});
  page.querySelector<HTMLElement>('.story-tabs')!.hidden=false;select(0,false);page.dataset.aboutReady='true';sync();
}
