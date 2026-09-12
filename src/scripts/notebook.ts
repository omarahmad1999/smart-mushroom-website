const book = document.querySelector<HTMLElement>('[data-notebook]');
if (book) {
  const spreads = [...book.querySelectorAll<HTMLElement>('[data-nb-spread]')];
  const pages = [...book.querySelectorAll<HTMLElement>('[data-nb-page]')];
  const jumps = [...book.querySelectorAll<HTMLAnchorElement>('[data-nb-jump]')];
  const previous = [...book.querySelectorAll<HTMLButtonElement>('[data-nb-prev]')];
  const next = [...book.querySelectorAll<HTMLButtonElement>('[data-nb-next]')];
  const binding = book.querySelector<HTMLElement>('[data-nb-binding]')!;
  const fold = book.querySelector<HTMLElement>('[data-nb-fold]')!;
  const status = book.querySelector<HTMLElement>('[data-nb-status]')!;
  const mobile = matchMedia('(max-width:760px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const contents = book.querySelector<HTMLDetailsElement>('.nb-contents')!;
  const cover=book.querySelector<HTMLElement>('[data-nb-cover]')!;
  const coverVideo=book.querySelector<HTMLVideoElement>('[data-nb-cover-video]')!;
  const coverPause=book.querySelector<HTMLButtonElement>('[data-nb-cover-pause]')!;
  const coverToggle=book.querySelector<HTMLButtonElement>('[data-nb-show-cover]')!;
  const spreadsWrap=book.querySelector<HTMLElement>('.nb-spreads')!;
  let coverInView=false,coverPaused=false;
  function syncCoverPlayback(){
    coverPause.hidden=reduced.matches;
    if(!cover.hidden&&coverInView&&!coverPaused&&!reduced.matches&&!document.hidden)void coverVideo.play().catch(()=>{});
    else coverVideo.pause();
    coverPause.textContent=coverPaused?'Play animation':'Pause animation';
    coverPause.setAttribute('aria-label',coverPaused?'Play cover animation':'Pause cover animation');
  }
  function setCover(open:boolean){
    cover.hidden=!open;book!.toggleAttribute('data-cover',open);spreadsWrap.inert=open;
    coverToggle.textContent=open?'Skip to pages':'View cover';
    syncCoverPlayback();
  }
  coverToggle.hidden=false;
  coverToggle.addEventListener('click',()=>setCover(Boolean(cover.hidden)));
  book.querySelector('[data-nb-open-cover]')!.addEventListener('click',()=>{setCover(false);binding.focus({preventScroll:true});});
  coverPause.addEventListener('click',()=>{coverPaused=!coverPaused;syncCoverPlayback();});
  new IntersectionObserver(entries=>{coverInView=entries[0].isIntersecting;syncCoverPlayback();},{threshold:.05}).observe(cover);
  document.addEventListener('visibilitychange',syncCoverPlayback);
  reduced.addEventListener('change',()=>{if(reduced.matches)coverVideo.load();syncCoverPlayback();});
  const journeyIndex=spreads.findIndex(el=>el.id==='notebook-journey');
  const journeyTabs=[...book.querySelectorAll<HTMLAnchorElement>('[data-journey-tab]')];
  const journeyPanels=[...book.querySelectorAll<HTMLElement>('[data-journey-panel]')];
  const piPhotoBoard=book.querySelector<HTMLElement>('[data-pi-photo-board]');
  let journeySelection=journeyTabs[0]?.dataset.journeyTab;
  function selectJourney(slug:string) {
    journeySelection=slug;
    journeyTabs.forEach(link=>{if(link.dataset.journeyTab===slug)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    journeyPanels.forEach(panel=>panel.toggleAttribute('data-active',panel.dataset.journeyPanel===slug));
    if(piPhotoBoard)piPhotoBoard.hidden=slug!=='raspberry-pi';
  }
  if(journeySelection)selectJourney(journeySelection);
  let current = 0;
  let animation: Animation | undefined;

  function render() {
    const spread = Math.floor(current / 2);
    book!.toggleAttribute('data-journey',spread===journeyIndex);
    spreads.forEach((el,i) => {el.toggleAttribute('data-active',i===spread);el.setAttribute('aria-hidden',String(i!==spread));});
    pages.forEach((el,i) => el.toggleAttribute('data-active',mobile.matches?i===current:Math.floor(i/2)===spread));
    jumps.forEach(link => { if(Number(link.dataset.nbJump)===spread)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
    previous.forEach(button=>button.disabled=current===0);
    next.forEach(button=>button.disabled=mobile.matches?current===pages.length-1:spread===spreads.length-1);
    status.textContent=`${spreads[spread].getAttribute('aria-label')} · ${mobile.matches?`Page ${current+1}`:`Pages ${current+1}–${current+2}`} / ${pages.length}`;
  }
  function turn(to:number, animate=true, updateUrl=true) {
    setCover(false);
    to=Math.max(0,Math.min(pages.length-1,to));
    if(!mobile.matches)to=Math.floor(to/2)*2;
    const old=current;
    animation?.cancel();fold.replaceChildren();
    if(to!==old&&animate&&!reduced.matches){
      const backwards=to<old;
      const copyPage=(index:number)=>{
        const copy=pages[index].cloneNode(true) as HTMLElement;
        copy.removeAttribute('data-nb-page');copy.setAttribute('data-active','');
        copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
        copy.querySelectorAll('details').forEach(el=>el.open=false);
        return copy;
      };
      const outgoing=copyPage(mobile.matches?old:old+(backwards?0:1));
      const leaf=document.createElement('div');leaf.className=`nb-leaf${backwards?' is-backward':''}`;leaf.inert=true;
      const front=document.createElement('div');front.className='nb-leaf-front';front.append(outgoing);
      const back=document.createElement('div');back.className='nb-leaf-back';
      // The reverse is the incoming facing page, so it lands without a blank-paper flash.
      if(!mobile.matches)back.append(copyPage(to+(backwards?1:0)));
      leaf.append(front,back);fold.append(leaf);
      // A filter on this parent flattens preserve-3d and exposes mirrored front text.
      // Keep shading on the faces and rotate only the unflattened paper leaf.
      animation=leaf.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${backwards?180:-180}deg)`}],{duration:580,easing:'cubic-bezier(.25,.65,.25,1)',fill:'forwards'});
      animation.onfinish=()=>leaf.remove();
    }
    current=to;render();
    if(animate&&to!==old&&binding.getBoundingClientRect().top<105)binding.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
    if(updateUrl)history.pushState(null,'',`#${spreads[Math.floor(current/2)].id}${mobile.matches&&current%2?'--notes':''}`);
  }
  function fromHash() {
    const hash=location.hash.slice(1);
    const journey=journeyPanels.find(panel=>panel.id===hash);
    if(journey&&journeyIndex>=0){selectJourney(journey.dataset.journeyPanel!);turn(journeyIndex*2+(mobile.matches?1:0),false,false);return;}
    const i=spreads.findIndex(el=>hash===el.id||hash===`${el.id}--notes`);
    if(i>=0)turn(i*2+(mobile.matches&&hash.endsWith('--notes')?1:0),false,false);
  }
  book.dataset.enhanced='true';
  book.querySelectorAll<HTMLElement>('[data-nb-controls],[data-nb-hint],[data-nb-prev],[data-nb-next]').forEach(el=>el.hidden=false);
  render();fromHash();setCover(!location.hash);
  const advance=(direction:number)=>turn(current+direction*(mobile.matches?1:2));
  previous.forEach(button=>button.addEventListener('click',()=>advance(-1)));
  next.forEach(button=>button.addEventListener('click',()=>advance(1)));
  jumps.forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const wasContents=contents.contains(link);contents.open=false;turn(Number(link.dataset.nbJump)*2);if(wasContents)book.querySelector<HTMLElement>(`.nb-tabs [data-nb-jump="${link.dataset.nbJump}"]`)?.focus({preventScroll:true});}));
  journeyTabs.forEach(link=>link.addEventListener('click',event=>{event.preventDefault();selectJourney(link.dataset.journeyTab!);turn(journeyIndex*2+(mobile.matches?1:0),false,false);history.pushState(null,'',link.hash);status.textContent=`The Journey · ${link.textContent?.trim()}`;}));
  mobile.addEventListener('change',()=>turn(current,false,false));
  window.addEventListener('hashchange',fromHash);
  window.addEventListener('popstate',fromHash);
  book.addEventListener('keydown',event=>{
    if(!cover.hidden)return;
    if((event.target as HTMLElement).closest('dialog,summary')||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();advance(event.key==='ArrowRight'?1:-1);}
  });
  // Only a horizontal gesture turns paper. Vertical scrolling remains native.
  let start: {x:number;y:number} | undefined;
  let dragged=false;
  binding.style.touchAction='pan-y';
  binding.addEventListener('pointerdown',event=>{
    const target=event.target as HTMLElement;
    if(target.closest('a,summary,details')||target.closest('button:not(.nb-corner)'))return;
    dragged=false;start={x:event.clientX,y:event.clientY};
    if(event.isTrusted)(target.closest<HTMLElement>('.nb-corner')??binding).setPointerCapture(event.pointerId);
  });
  binding.addEventListener('pointerup',event=>{
    if(!start)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;start=undefined;
    if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){dragged=true;advance(dx<0?1:-1);}
  });
  binding.addEventListener('pointercancel',()=>start=undefined);
  binding.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopPropagation();dragged=false;}},true);

  const dialog=book.querySelector<HTMLDialogElement>('.nb-lightbox')!;
  const image=dialog.querySelector('img')!;
  let opener:HTMLElement|undefined;
  book.querySelectorAll<HTMLAnchorElement>('[data-nb-image]').forEach(link=>link.addEventListener('click',event=>{
    event.preventDefault();opener=link;image.src=link.href;image.alt=link.querySelector('img')!.alt;
    dialog.querySelector('figcaption')!.textContent=link.dataset.caption!;dialog.showModal();
  }));
  dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));

  const piPhotosDialog=book.querySelector<HTMLDialogElement>('[data-pi-photos-dialog]')!;
  let piPhotosOpener:HTMLButtonElement|undefined;
  book.querySelectorAll<HTMLButtonElement>('[data-pi-photos-open]').forEach(button=>button.addEventListener('click',()=>{piPhotosOpener=button;piPhotosDialog.showModal();}));
  piPhotosDialog.querySelector<HTMLButtonElement>('[data-pi-photos-close]')!.addEventListener('click',()=>piPhotosDialog.close());
  piPhotosDialog.addEventListener('click',event=>{if(event.target===piPhotosDialog){const rect=piPhotosDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)piPhotosDialog.close();}});
  piPhotosDialog.addEventListener('close',()=>piPhotosOpener?.focus({preventScroll:true}));

  const designDialog=book.querySelector<HTMLDialogElement>('[data-initial-design-dialog]')!;
  let designOpener:HTMLButtonElement|undefined;
  book.querySelectorAll<HTMLButtonElement>('[data-initial-design-open]').forEach(button=>button.addEventListener('click',()=>{
    designOpener=button;designDialog.showModal();
  }));
  designDialog.querySelector<HTMLButtonElement>('[data-initial-design-close]')!.addEventListener('click',()=>designDialog.close());
  designDialog.addEventListener('click',event=>{
    if(event.target===designDialog){const rect=designDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)designDialog.close();}
  });
  designDialog.addEventListener('close',()=>designOpener?.focus({preventScroll:true}));
}
