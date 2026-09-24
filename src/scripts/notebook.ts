import { createLeaf, type Leaf, type LeafOptions, type LeafState, type Row } from './notebook-turn';

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
  const paperSwipe=new Audio('/media/study/paper-swipe.mp3');
  paperSwipe.preload='auto';paperSwipe.volume=.42;
  const playPaperSwipe=()=>{paperSwipe.pause();paperSwipe.currentTime=0;void paperSwipe.play().catch(()=>{});};
  let coverInView=false,coverPaused=false;
  function syncCoverPlayback(){
    coverPause.hidden=reduced.matches;
    if(!cover.hidden&&coverInView&&!coverPaused&&!reduced.matches&&!document.hidden)void coverVideo.play().catch(()=>{});
    else coverVideo.pause();
    coverPause.textContent=coverPaused?'Play animation':'Pause animation';
    coverPause.setAttribute('aria-label',coverPaused?'Play cover animation':'Pause cover animation');
  }
  let coverMotion:Animation[]=[];
  function stopCoverMotion(){
    const running=coverMotion;coverMotion=[];running.forEach(animation=>animation.cancel());
    book!.querySelector('.nb-cover-back')?.remove();delete book!.dataset.coverMotion;
  }
  function setCover(open:boolean){
    stopCoverMotion();
    cover.hidden=!open;book!.toggleAttribute('data-cover',open);spreadsWrap.inert=open;
    coverToggle.textContent=open?'Skip to pages':'View cover';
    syncCoverPlayback();
  }
  // The cover is a rigid board hinged at the spine. Opening, the closed book slides so the
  // spine reaches the centre, then the board swings over and its inside lands on the left page.
  // Closing plays the same motion in reverse.
  function swingCover(showCover:boolean){
    if(reduced.matches){setCover(showCover);return;}
    const desktop=!mobile.matches;
    setCover(false);cover.hidden=false;spreadsWrap.inert=true;book!.dataset.coverMotion=showCover?'close':'open';
    const timing:KeyframeAnimationOptions={duration:desktop?1150:760,fill:'both',direction:showCover?'reverse':'normal'};
    const ease='cubic-bezier(.42,.06,.22,1)',lift=desktop?.32:.08;
    const motion=[cover.animate([{transform:'rotateY(0deg)',filter:'brightness(1)',easing:ease},{transform:'rotateY(-10deg)',filter:'brightness(.98)',offset:lift,easing:ease},{transform:'rotateY(-180deg)',filter:'brightness(.78)'}],timing)];
    if(desktop){
      const back=document.createElement('div');back.className='nb-cover-back';back.setAttribute('aria-hidden','true');
      back.append(copyPage(Math.floor(current/2)*2));binding.append(back);
      motion.push(
        back.animate([{transform:'rotateY(180deg)',filter:'brightness(.78)',easing:ease},{transform:'rotateY(170deg)',filter:'brightness(.8)',offset:lift,easing:ease},{transform:'rotateY(0deg)',filter:'brightness(1)'}],timing),
        binding.animate([{transform:'translateX(-25%)',easing:'cubic-bezier(.3,.1,.2,1)'},{transform:'translateX(0)',offset:lift+.04},{transform:'translateX(0)'}],timing),
      );
    }
    coverMotion=motion;
    void Promise.all(motion.map(animation=>animation.finished)).then(()=>{if(coverMotion===motion)setCover(showCover);},()=>undefined);
  }
  coverToggle.hidden=false;
  coverToggle.addEventListener('click',()=>{const show=Boolean(cover.hidden)&&!book!.dataset.coverMotion;playPaperSwipe();swingCover(show);});
  book.querySelector('[data-nb-open-cover]')!.addEventListener('click',()=>{playPaperSwipe();swingCover(false);binding.focus({preventScroll:true});});
  coverPause.addEventListener('click',()=>{coverPaused=!coverPaused;syncCoverPlayback();});
  new IntersectionObserver(entries=>{coverInView=entries[0].isIntersecting;syncCoverPlayback();},{threshold:.05}).observe(cover);
  document.addEventListener('visibilitychange',syncCoverPlayback);
  reduced.addEventListener('change',()=>{if(reduced.matches)coverVideo.load();syncCoverPlayback();});
  const journeyIndex=spreads.findIndex(el=>el.id==='notebook-journey');
  const journeyTabs=[...book.querySelectorAll<HTMLAnchorElement>('[data-journey-tab]')];
  const journeyPanels=[...book.querySelectorAll<HTMLElement>('[data-journey-panel]')];
  const journeyPhotoBoards=[...book.querySelectorAll<HTMLElement>('[data-journey-photo-board]')];
  let journeySelection=journeyTabs[0]?.dataset.journeyTab;
  function selectJourney(slug:string) {
    journeySelection=slug;
    journeyTabs.forEach(link=>{if(link.dataset.journeyTab===slug)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    journeyPanels.forEach(panel=>panel.toggleAttribute('data-active',panel.dataset.journeyPanel===slug));
    journeyPhotoBoards.forEach(board=>board.hidden=board.dataset.journeyPhotoBoard!==slug);
  }
  if(journeySelection)selectJourney(journeySelection);
  let current = 0;
  // One paper leaf at a time: an automatic turn, a live drag, or a corner peek.
  let active: { leaf: Leaf; from: number; to: number; kind: 'turn' | 'drag' | 'peek' } | undefined;
  const hoverPointer=matchMedia('(hover:hover) and (pointer:fine)');

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
  const copyPage=(index:number)=>{
    const copy=pages[index].cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-nb-page');copy.setAttribute('data-active','');
    copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    copy.querySelectorAll('details').forEach(el=>el.open=false);
    return copy;
  };
  // A shallow clone keeps the scoped style attribute, so the reverse still reads as paper.
  const blankPage=()=>{const paper=pages[0].cloneNode(false) as HTMLElement;paper.removeAttribute('data-nb-page');paper.classList.add('nb-leaf-blank');paper.setAttribute('data-active','');return paper;};
  const placed=(page:HTMLElement,left:number,width:number)=>{Object.assign(page.style,{left:`${left}px`,width:`${width}px`});return page;};
  /** Builds the leaf between two positions. The leaf and the pages under it cover the whole spread. */
  function buildLeaf(from:number,to:number,row:Row,kind:'turn'|'drag'|'peek') {
    const width=fold.clientWidth,height=fold.clientHeight,backwards=to<from;
    let options:Pick<LeafOptions,'spine'|'width'|'right'|'left'|'under'>;
    if(mobile.matches){
      // One page at a time: the leaf leaves over the left edge and its reverse is plain paper.
      options={spine:0,width,right:copyPage(backwards?to:from),left:blankPage(),under:[placed(copyPage(backwards?from:to),0,width)]};
    }else{
      const half=width/2,oldLeft=Math.floor(from/2)*2,newLeft=Math.floor(to/2)*2;
      options=backwards
        ?{spine:half,width:half,right:copyPage(newLeft+1),left:copyPage(oldLeft),under:[placed(copyPage(newLeft),0,half),placed(copyPage(oldLeft+1),half,half)]}
        :{spine:half,width:half,right:copyPage(oldLeft+1),left:copyPage(newLeft),under:[placed(copyPage(oldLeft),0,half),placed(copyPage(newLeft+1),half,half)]};
    }
    const leaf=createLeaf({...options,host:fold,height,row,start:backwards?'turned':'flat',shadow:!mobile.matches});
    leaf.element.dataset.kind=kind;
    active={leaf,from,to,kind};
    return active;
  }
  function dropLeaf(){active?.leaf.destroy();active=undefined;}
  /** Plays the active leaf to rest and removes it, unless another leaf has replaced it. */
  function settle(state:LeafState,duration?:number){
    const entry=active!;
    void entry.leaf.play(state,duration).then(()=>{if(active===entry)dropLeaf();else entry.leaf.destroy();});
  }
  const pageStep=()=>mobile.matches?1:2;
  function commit(to:number,animate:boolean,updateUrl:boolean,old:number){
    current=to;render();
    if(animate&&to!==old&&binding.getBoundingClientRect().top<105)binding.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
    if(updateUrl)history.pushState(null,'',`#${spreads[Math.floor(current/2)].id}${mobile.matches&&current%2?'--notes':''}`);
  }
  function turn(to:number, animate=true, updateUrl=true) {
    setCover(false);
    to=Math.max(0,Math.min(pages.length-1,to));
    if(!mobile.matches)to=Math.floor(to/2)*2;
    const old=current;
    const reuse=active&&active.kind!=='turn'&&active.from===old&&active.to===to;
    if(!reuse)dropLeaf();
    if(to!==old&&animate&&!reduced.matches){
      playPaperSwipe();
      // A peeking corner continues into the turn instead of snapping back first.
      if(!reuse)buildLeaf(old,to,'bottom','turn');else active!.kind='turn';
      settle(to<old?'flat':'turned');
    }else dropLeaf();
    commit(to,animate,updateUrl,old);
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
  // Once a drag is clearly sideways, the page corner follows the pointer; releasing
  // past a third of the turn (or flicking) completes it, otherwise it springs back.
  let start: {x:number;y:number;time:number;id:number} | undefined;
  let grab: {corner:{x:number;y:number};forward:boolean} | undefined;
  let last={x:0,time:0},velocity=0;
  let dragged=false;
  binding.style.touchAction='pan-y';
  const foldPoint=(event:PointerEvent)=>{const box=fold.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top};};
  binding.addEventListener('pointerdown',event=>{
    const target=event.target as HTMLElement;
    if(!cover.hidden||event.button>0||target.closest('summary,details,dialog,input,textarea')||target.closest('button:not(.nb-corner)'))return;
    dragged=false;grab=undefined;velocity=0;start={x:event.clientX,y:event.clientY,time:event.timeStamp,id:event.pointerId};last={x:event.clientX,time:event.timeStamp};
    if(event.isTrusted&&event.pointerType!=='mouse')(target.closest<HTMLElement>('.nb-corner')??binding).setPointerCapture(event.pointerId);
  });
  binding.addEventListener('pointermove',event=>{
    if(!start||event.pointerId!==start.id)return;
    if(event.timeStamp>last.time){velocity=(event.clientX-last.x)/(event.timeStamp-last.time);last={x:event.clientX,time:event.timeStamp};}
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(!grab){
      if(reduced.matches||Math.abs(dx)<14||Math.abs(dx)<Math.abs(dy)*1.3)return;
      const forward=dx<0,target=current+(forward?1:-1)*pageStep();
      if(target<0||target>pages.length-1||(!mobile.matches&&Math.floor(target/2)>=spreads.length)){start=undefined;return;}
      const box=fold.getBoundingClientRect(),row:Row=start.y-box.top<box.height/2?'top':'bottom';
      if(!(active?.kind==='peek'&&active.from===current&&active.to===target))dropLeaf();
      const entry=active??buildLeaf(current,target,row,'drag');entry.kind='drag';
      const corner=entry.leaf.corner(forward?'flat':'turned');
      grab={corner,forward};dragged=true;book!.dataset.dragging='';getSelection()?.removeAllRanges();
      if(event.isTrusted)binding.setPointerCapture(event.pointerId);
    }
    const point=foldPoint(event),origin={x:start.x-fold.getBoundingClientRect().left,y:start.y-fold.getBoundingClientRect().top};
    active?.leaf.follow({x:grab.corner.x+point.x-origin.x,y:grab.corner.y+point.y-origin.y});
  });
  const release=(event:PointerEvent,cancelled=false)=>{
    if(!start||event.pointerId!==start.id)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;start=undefined;delete book!.dataset.dragging;
    if(grab&&active?.kind==='drag'){
      const entry=active,progress=entry.leaf.progress(),forward=grab.forward;grab=undefined;
      const done=!cancelled&&(forward?progress>.33||velocity<-.45:progress<.67||velocity>.45);
      if(done){playPaperSwipe();const old=current;commit(entry.to,true,true,old);entry.kind='turn';settle(forward?'turned':'flat',420);}
      else settle(forward?'flat':'turned',360);
      return;
    }
    grab=undefined;
    if(!cancelled&&Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){dragged=true;advance(dx<0?1:-1);}
  };
  binding.addEventListener('pointerup',event=>release(event));
  binding.addEventListener('pointercancel',event=>release(event,true));
  binding.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopPropagation();dragged=false;}},true);
  binding.addEventListener('dragstart',event=>event.preventDefault());
  // A hovered corner lifts slightly to show the page beneath. Clicking it continues the turn.
  book.querySelectorAll<HTMLButtonElement>('.nb-corner').forEach(corner=>{
    const forward=corner.classList.contains('nb-corner-next');
    corner.addEventListener('pointerenter',event=>{
      if(event.pointerType!=='mouse'||!hoverPointer.matches||reduced.matches||!cover.hidden||corner.disabled||active||start)return;
      const target=current+(forward?1:-1)*pageStep();if(target<0||target>pages.length-1)return;
      const entry=buildLeaf(current,target,'bottom','peek');
      const rest=entry.leaf.corner(forward?'flat':'turned');
      void entry.leaf.play({x:rest.x+(forward?-70:70),y:rest.y-44},280);
    });
    corner.addEventListener('pointerleave',()=>{if(active?.kind==='peek')settle(forward?'flat':'turned',220);});
  });
  addEventListener('resize',()=>{if(active&&active.kind!=='turn')dropLeaf();});

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

  const journeyPhotosDialog=book.querySelector<HTMLDialogElement>('[data-journey-photos-dialog]')!;
  const journeyPhotoPanels=[...journeyPhotosDialog.querySelectorAll<HTMLElement>('[data-journey-photos-panel]')];
  const journeyPhotosName=journeyPhotosDialog.querySelector<HTMLElement>('[data-journey-photos-name]')!;
  let journeyPhotosOpener:HTMLButtonElement|undefined;
  book.querySelectorAll<HTMLButtonElement>('[data-journey-photos-open]').forEach(button=>button.addEventListener('click',()=>{
    journeyPhotosOpener=button;const slug=button.dataset.journeyPhotosOpen!;
    journeyPhotoPanels.forEach(panel=>panel.hidden=panel.dataset.journeyPhotosPanel!==slug);
    journeyPhotosName.textContent=journeyTabs.find(tab=>tab.dataset.journeyTab===slug)?.querySelector('.journey-tab-label')?.textContent??slug;
    journeyPhotosDialog.showModal();
  }));
  journeyPhotosDialog.querySelector<HTMLButtonElement>('[data-journey-photos-close]')!.addEventListener('click',()=>journeyPhotosDialog.close());
  journeyPhotosDialog.addEventListener('click',event=>{if(event.target===journeyPhotosDialog){const rect=journeyPhotosDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)journeyPhotosDialog.close();}});
  journeyPhotosDialog.addEventListener('close',()=>journeyPhotosOpener?.focus({preventScroll:true}));

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
