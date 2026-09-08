import { gsap } from 'gsap';

/** A finite, authored explanation. No readings, clocks from devices, or services. */
export function mountSystemFlow(root: HTMLElement) {
  const canvas=root.querySelector<HTMLElement>('[data-pathway-canvas]')!;
  const controls=root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton=root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton=root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status=root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const narrow=matchMedia('(max-width: 760px)');
  const abort=new AbortController();
  const events={signal:abort.signal};
  const select=(query:string)=>Array.from(root.querySelectorAll<SVGElement>(query));
  const flowName=root.dataset.flowName!;
  const branched=root.dataset.systemFlow==='observe';
  const names=Array.from(root.querySelectorAll<SVGElement>('[data-flow-layout="wide"] [data-flow-node]'),node=>node.dataset.flowNode!);
  const lastId=names.at(-1)!;
  const firstStage=branched?'sensors':names[0];
  const styles=getComputedStyle(root);
  const palette={orange:styles.getPropertyValue('--flow-orange').trim(),green:styles.getPropertyValue('--flow-green').trim()};
  const accent=(id:string)=>id===lastId?palette.green:palette.orange;
  const titleColor=(id:string)=>styles.getPropertyValue(id===lastId?'--flow-label-green':'--flow-label-orange').trim();
  const titleGlyphs='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%+/';
  const rimDuration=1.10, rimTravel=1.14, pulseTravel=1.12;
  let active=true, visible=false, userPaused=false, complete=false, alive=true;

  function syncControls() {
    const playing=active&&visible&&!document.hidden&&!userPaused&&!complete&&!reduced.matches;
    const state=reduced.matches?'static':complete?'complete':playing?'running':userPaused?'paused':timeline.time()===0?'idle':'paused';
    root.dataset.flowState=state;
    pauseButton.disabled=complete||reduced.matches;
    pauseButton.setAttribute('aria-label',`${userPaused?'Play':'Pause'} ${flowName} Animation`);
    root.querySelector('[data-pathway-pause-label]')!.textContent=userPaused?'Play':'Pause';
    root.querySelector('[data-pathway-pause-icon]')!.textContent=userPaused?'▷':'Ⅱ';
    controls.hidden=reduced.matches;
  }
  function resetAppearance() {
    gsap.set(select('[data-flow-letter],.pathway-liquid'),{opacity:0});
    gsap.set(select('.pathway-corner-dot'),{fill:'#cdd1d3'});
    gsap.set(select('.pathway-aura,.pathway-light,.pathway-halo,.pathway-rim,.pathway-name-highlight'),{opacity:0});
    gsap.set(select('.pathway-rim'),{attr:{'stroke-dasharray':'.14 1','stroke-dashoffset':'.14'}});
    gsap.set(select('.pathway-glyph'),{color:'#a0a0a0'});
    gsap.set(select('.pathway-name'),{opacity:0,fill:'#888888'});
    for(const title of select('[data-flow-title]'))title.textContent=title.dataset.flowTitle!;
    gsap.set(select('.pathway-pulse'),{opacity:0,attr:{'stroke-dashoffset':.12,'stroke-dasharray':'.12 1'}});
    root.dataset.flowStage=firstStage;
  }
  const timeline=gsap.timeline({paused:true,onComplete:()=>{
    complete=true;root.dataset.flowStage=lastId;syncControls();
    status.textContent=`The ${flowName} path is complete. ${root.dataset.flowCompletion} Replay to follow it again.`;
  }});

  function stage(name:string,time:number) {
    timeline.call(()=>{root.dataset.flowStage=name;},[],time);
  }
  function scrambleTitle(id:string,time:number) {
    const titles=select(`[data-flow-node="${id}"] [data-flow-title]`);
    const progress={value:0};
    const seed=(names.indexOf(id)+1)*19;
    // A short run of glyphs resolves left to right. The same timeline drives
    // both layouts, so pausing also freezes the letters and the border bolt.
    timeline.set(titles,{opacity:1,fill:titleColor(id)},time)
      .fromTo(progress,{value:0},{value:1,duration:1,ease:'none',immediateRender:false,onUpdate:()=>{
        const tick=Math.floor(progress.value*16);
        for(const title of titles) {
          const text=title.dataset.flowTitle!;
          const settled=Math.floor(Math.max(0,(progress.value-.20)/.80)*text.length);
          const next=Array.from(text,(letter,index)=>letter===' '||index<settled||progress.value>=1
            ?letter:titleGlyphs[(seed+tick*7+index*11)%titleGlyphs.length]).join('');
          if(title.textContent!==next)title.textContent=next;
        }
      }},time);
  }
  function liquid(selector:string,geometrySelector:string,time:number,duration:number) {
    const shapes=select(selector).map(shape=>({shape,geometry:shape.parentElement!.querySelector<SVGGeometryElement>(geometrySelector)!}));
    const samples=shapes.map(item=>({...item,length:item.geometry.getTotalLength()}));
    const motion={progress:0};
    timeline.set(shapes.map(item=>item.shape),{opacity:1},time)
      .fromTo(motion,{progress:0},{progress:1,duration,ease:'none',immediateRender:false,onUpdate:()=>{
        for(const {shape,geometry,length} of samples) {
          // A rounded fluid head pulls a tapering tail along the actual curve.
          const tail=length*.14,head=(length+tail)*motion.progress;
          const start=Math.max(0,head-tail),end=Math.min(length,head);
          if(end<=start){shape.setAttribute('d','');continue;}
          const left:string[]=[],right:string[]=[];
          for(let index=0;index<=28;index++) {
            const distance=start+(end-start)*index/28;
            const fraction=Math.max(0,Math.min(1,(distance-head+tail)/tail));
            const point=geometry.getPointAtLength(distance);
            const before=geometry.getPointAtLength(Math.max(0,distance-.5));
            const after=geometry.getPointAtLength(Math.min(length,distance+.5));
            const dx=after.x-before.x,dy=after.y-before.y,norm=Math.hypot(dx,dy)||1;
            const width=3.2*Math.pow(Math.sin(Math.PI*fraction),.65)*(.4+.6*fraction)*(1+.18*Math.sin(motion.progress*Math.PI*4));
            left.push(`${point.x-dy/norm*width},${point.y+dx/norm*width}`);
            right.unshift(`${point.x+dy/norm*width},${point.y-dx/norm*width}`);
          }
          shape.setAttribute('d',`M${left.join('L')}L${right.join('L')}Z`);
        }
      }},time)
      .set(shapes.map(item=>item.shape),{opacity:0},time+duration);
  }
  function activate(ids:string[],time:number) {
    for(const id of ids) {
      const part=(name:string)=>select(`[data-flow-node="${id}"] ${name}`);
      timeline.to(part('.pathway-aura'),{opacity:.18,duration:.25,ease:'sine.out'},time)
        .to(part('.pathway-aura'),{opacity:.08,duration:.63,ease:'sine.inOut'},time+.25)
        .to(part('.pathway-light'),{opacity:.38,duration:.25,ease:'sine.out'},time)
        .to(part('.pathway-light'),{opacity:.22,duration:.63,ease:'sine.inOut'},time+.25)
        .to(part('.pathway-halo'),{opacity:.6,duration:.25,ease:'sine.out'},time)
        .to(part('.pathway-halo'),{opacity:.35,duration:.63,ease:'sine.inOut'},time+.25)
        .to(part('.pathway-glyph'),{color:accent(id),duration:.36},time)
        .to(part('.pathway-name-highlight'),{opacity:.13,duration:.36},time+.1)
        .set(part('.pathway-rim'),{opacity:1},time)
        .to(part('.pathway-rim'),{attr:{'stroke-dashoffset':-1},duration:rimDuration,ease:'none'},time)
        .set(part('.pathway-rim'),{opacity:0},time+rimDuration);
      timeline.to(part('.pathway-rim'),{attr:{'stroke-dasharray':'.19 1'},duration:rimDuration/2,repeat:1,yoyo:true,ease:'sine.inOut'},time);
      timeline.to(part('.pathway-corner-dot'),{fill:accent(id),duration:.3},time);
      liquid(`[data-liquid-node="${id}"]`,'.pathway-rim-body',time,rimDuration);
      scrambleTitle(id,time);
    }
  }
  function pulse(id:string,time:number,duration:number) {
    const pulse=select(`[data-flow-pulse="${id}"]`);
    timeline.set(pulse,{opacity:1,attr:{'stroke-dashoffset':.12}},time)
      .to(pulse,{attr:{'stroke-dashoffset':-1},duration,ease:'none'},time)
      .set(pulse,{opacity:0},time+duration);
    liquid(`[data-liquid-link="${id}"]`,'.pathway-pulse-body',time,duration);
    // The short stream stretches and gathers again as it rounds the route.
    // Its head keeps the same travel speed; all shaping pauses with this timeline.
    timeline.to(pulse,{attr:{'stroke-dasharray':'.17 1'},duration:duration/2,repeat:1,yoyo:true,ease:'sine.inOut'},time);
  }
  function reveal(id:string,time:number,duration:number) {
    // Each responsive drawing receives an identical, simultaneous character run.
    for(const group of select(`[data-flow-caption="${id}"]`)) {
      timeline.to(group.querySelectorAll('[data-flow-letter]'),{opacity:1,duration:.20,stagger:{amount:duration-.20},ease:'none'},time);
    }
  }
  function fade(id:string,time:number,duration:number) {
    for(const group of select(`[data-flow-caption="${id}"]`)) {
      timeline.to(group.querySelectorAll('[data-flow-letter]'),{opacity:0,duration:.12,stagger:{amount:duration-.12},ease:'none'},time);
    }
  }

  function buildSequence() {
    // Measure illustration geometry only. Equal distance per second prevents
    // a bolt from slowing down on a short link or speeding up on mobile bends.
    const diagram=root.querySelector<SVGSVGElement>(`[data-flow-layout="${narrow.matches?'narrow':'wide'}"]`)!;
    const rim=diagram.querySelector<SVGRectElement>('.pathway-rim')!;
    const speed=rim.getTotalLength()*rimTravel/rimDuration;
    const travel=(id:string)=>diagram.querySelector<SVGPathElement>(`[data-flow-path="${id}"]`)!.getTotalLength()*pulseTravel/speed;
    let arrival=.25, previous:string|undefined;
    stage(firstStage,arrival);activate(branched?names.slice(0,2):names.slice(0,1),arrival);
    if(branched) {
      const branchDuration=Math.max(travel('sht31'),travel('scd41'));
      const mergedDuration=travel('merged');
      const departure=arrival+rimDuration, merge=departure+branchDuration;
      arrival=merge+mergedDuration;
      stage('to-mqtt',departure);
      pulse('sht31',departure,branchDuration);pulse('scd41',departure,branchDuration);
      reveal('readings',departure,branchDuration+mergedDuration);
      pulse('merged',merge,mergedDuration);
      stage('mqtt',arrival);activate(['mqtt'],arrival);
      previous='readings';
    }
    const handoffs=Array.from(diagram.querySelectorAll<SVGPathElement>('[data-flow-target]'));
    for(const link of handoffs) {
      const path=link.dataset.flowPath!,destination=link.dataset.flowTarget!;
      if(path==='merged')continue;
      const start=arrival+rimDuration,duration=travel(path);
      stage(`to-${destination}`,start);
      if(previous)fade(previous,start,Math.min(.65,duration));
      reveal(path,start,duration);pulse(path,start,duration);
      arrival=start+duration;
      stage(destination,arrival);activate([destination],arrival);
      previous=path;
    }
    timeline.to({}, {duration:.15},arrival+rimDuration);
  }
  timeline.timeScale(1.45);
  buildSequence();

  function stillView() {
    timeline.pause();complete=false;
    resetAppearance();
    gsap.set(select('[data-flow-letter]'),{opacity:1});
    gsap.set(select('.pathway-aura'),{opacity:.08});
    gsap.set(select('.pathway-light'),{opacity:.22});
    gsap.set(select('.pathway-halo'),{opacity:.35});
    gsap.set(select('.pathway-name-highlight'),{opacity:.10});
    gsap.set(select('.pathway-name'),{opacity:1});
    for(const id of names) {
      gsap.set(select(`[data-flow-node="${id}"] .pathway-corner-dot`),{fill:accent(id)});
      gsap.set(select(`[data-flow-node="${id}"] .pathway-glyph`),{color:accent(id)});
      gsap.set(select(`[data-flow-node="${id}"] .pathway-name`),{fill:titleColor(id)});
    }
    root.dataset.flowStage='all';status.textContent=`The complete ${flowName} pathway is shown with motion reduced.`;
    syncControls();
  }
  function syncPlayback() {
    if(!alive)return;
    if(reduced.matches){stillView();return;}
    if(active&&visible&&!document.hidden&&!userPaused&&!complete) timeline.play();
    else timeline.pause();
    syncControls();
  }
  function restart() {
    timeline.pause(0,true);timeline.invalidate();complete=false;userPaused=false;
    resetAppearance();status.textContent=`Following the ${flowName} pathway.`;
    syncPlayback();
  }
  pauseButton.addEventListener('click',()=>{userPaused=!userPaused;syncPlayback();},events);
  replayButton.addEventListener('click',restart,events);
  const intersection=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;syncPlayback();
  },{threshold:0});
  intersection.observe(canvas);
  document.addEventListener('visibilitychange',syncPlayback,events);
  reduced.addEventListener('change',()=>reduced.matches?stillView():restart(),events);
  narrow.addEventListener('change',()=>{
    // The responsive drawing has different line lengths. Restart its authored
    // explanation at the same speed, retaining any deliberate user pause.
    timeline.pause(0,true);timeline.clear();complete=false;
    resetAppearance();buildSequence();
    status.textContent=`Following the ${flowName} pathway.`;
    syncPlayback();
  },events);
  window.addEventListener('pagehide',event=>{
    timeline.pause();
    if(event.persisted)return;
    alive=false;intersection.disconnect();abort.abort();timeline.kill();
  },events);
  window.addEventListener('pageshow',syncPlayback,events);
  resetAppearance();syncControls();if(reduced.matches)stillView();
  return {
    setActive(value:boolean, replay=false) {
      active=value;
      if(value&&replay)restart();else syncPlayback();
    },
  };
}
