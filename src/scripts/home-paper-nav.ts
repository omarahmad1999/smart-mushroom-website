const paperNavigation=document.querySelector<HTMLElement>('[data-home-paper-nav]');
if(paperNavigation){
  const toggle=paperNavigation.querySelector<HTMLButtonElement>('.paper-index-tab')!;
  const sheet=paperNavigation.querySelector<HTMLElement>('.paper-index-sheet')!;
  const close=paperNavigation.querySelector<HTMLButtonElement>('.paper-index-close')!;
  const links=[...paperNavigation.querySelectorAll<HTMLAnchorElement>('[data-home-section]')];
  let closeTimer=0;
  const setOpen=(open:boolean)=>{
    window.clearTimeout(closeTimer);
    toggle.setAttribute('aria-expanded',String(open));
    if(open){sheet.hidden=false;requestAnimationFrame(()=>paperNavigation.toggleAttribute('data-open',true));}
    else{
      paperNavigation.removeAttribute('data-open');
      closeTimer=window.setTimeout(()=>{sheet.hidden=true;},matchMedia('(prefers-reduced-motion:reduce)').matches?0:330);
    }
  };
  toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
  close.addEventListener('click',()=>{setOpen(false);toggle.focus();});
  links.forEach(link=>link.addEventListener('click',()=>setOpen(false)));
  document.addEventListener('pointerdown',event=>{if(toggle.getAttribute('aria-expanded')==='true'&&!paperNavigation.contains(event.target as Node))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setOpen(false);toggle.focus();}});
  const sections=links.map(link=>document.getElementById(link.dataset.homeSection!)).filter((section):section is HTMLElement=>Boolean(section));
  const syncActive=()=>{
    const probe=innerHeight*.38;
    let active=sections[0]?.id;
    for(const section of sections)if(section.getBoundingClientRect().top<=probe)active=section.id;
    links.forEach(link=>{if(link.dataset.homeSection===active)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
  };
  addEventListener('scroll',syncActive,{passive:true});addEventListener('resize',syncActive,{passive:true});syncActive();
}
