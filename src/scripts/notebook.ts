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
  let current = 0;
  let animation: Animation | undefined;

  function render() {
    const spread = Math.floor(current / 2);
    spreads.forEach((el,i) => el.toggleAttribute('data-active',i===spread));
    pages.forEach((el,i) => el.toggleAttribute('data-active',mobile.matches?i===current:Math.floor(i/2)===spread));
    jumps.forEach(link => { if(Number(link.dataset.nbJump)===spread)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
    previous.forEach(button=>button.disabled=current===0);
    next.forEach(button=>button.disabled=mobile.matches?current===pages.length-1:spread===spreads.length-1);
    status.textContent=`${spreads[spread].getAttribute('aria-label')} · ${mobile.matches?`Page ${current+1}`:`Pages ${current+1}–${current+2}`} / ${pages.length}`;
  }
  function turn(to:number, animate=true, updateUrl=true) {
    to=Math.max(0,Math.min(pages.length-1,to));
    if(!mobile.matches)to=Math.floor(to/2)*2;
    const old=current;
    animation?.cancel();fold.replaceChildren();
    if(to!==old&&animate&&!reduced.matches){
      const backwards=to<old;
      const outgoing=pages[mobile.matches?old:old+(backwards?0:1)].cloneNode(true) as HTMLElement;
      outgoing.removeAttribute('data-nb-page');
      outgoing.setAttribute('data-active','');
      outgoing.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
      outgoing.querySelectorAll('details').forEach(el=>el.open=false);
      const leaf=document.createElement('div');leaf.className=`nb-leaf${backwards?' is-backward':''}`;leaf.inert=true;
      const front=document.createElement('div');front.className='nb-leaf-front';front.append(outgoing);
      const back=document.createElement('div');back.className='nb-leaf-back';leaf.append(front,back);fold.append(leaf);
      animation=leaf.animate([{transform:'rotateY(0deg)',filter:'brightness(1)'},{transform:`rotateY(${backwards?90:-90}deg)`,filter:'brightness(.89)',offset:.55},{transform:`rotateY(${backwards?178:-178}deg)`,filter:'brightness(1)'}],{duration:580,easing:'cubic-bezier(.25,.65,.25,1)'});
      animation.onfinish=()=>leaf.remove();
    }
    current=to;render();
    if(animate&&to!==old&&binding.getBoundingClientRect().top<105)binding.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
    if(updateUrl)history.pushState(null,'',`#${spreads[Math.floor(current/2)].id}${mobile.matches&&current%2?'--notes':''}`);
  }
  function fromHash() {
    const hash=location.hash.slice(1);
    const i=spreads.findIndex(el=>hash===el.id||hash===`${el.id}--notes`);
    if(i>=0)turn(i*2+(mobile.matches&&hash.endsWith('--notes')?1:0),false,false);
  }
  book.dataset.enhanced='true';
  book.querySelectorAll<HTMLElement>('[data-nb-controls],[data-nb-hint],[data-nb-prev],[data-nb-next]').forEach(el=>el.hidden=false);
  render();fromHash();
  const advance=(direction:number)=>turn(current+direction*(mobile.matches?1:2));
  previous.forEach(button=>button.addEventListener('click',()=>advance(-1)));
  next.forEach(button=>button.addEventListener('click',()=>advance(1)));
  jumps.forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const wasContents=contents.contains(link);contents.open=false;turn(Number(link.dataset.nbJump)*2);if(wasContents)book.querySelector<HTMLElement>(`.nb-tabs [data-nb-jump="${link.dataset.nbJump}"]`)?.focus({preventScroll:true});}));
  mobile.addEventListener('change',()=>turn(current,false,false));
  window.addEventListener('hashchange',fromHash);
  window.addEventListener('popstate',fromHash);
  book.addEventListener('keydown',event=>{
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
}
