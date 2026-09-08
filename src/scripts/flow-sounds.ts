type Cue = 'node' | 'scramble' | 'travel' | 'complete' | 'click';
const levels:Record<Cue,number>={node:.19,scramble:.08,travel:.18,complete:.22,click:.15};

/** Local illustration sound effects, unlocked only by the visitor's sound toggle. */
export function createFlowSounds() {
  const players=new Map<Cue,HTMLAudioElement>();
  const owners=new Map<Cue,string>();
  let enabled=false,disposed=false,revision=0;
  function stop(owner?:string) {
    for(const [cue,audio] of players)if(!owner||owners.get(cue)===owner){
      audio.pause();audio.currentTime=0;owners.delete(cue);
    }
  }
  return {
    get enabled(){return enabled;},
    async enable() {
      const attempt=++revision;
      // Unlock every reusable player within the click gesture, silently. This
      // also loads the tiny local clips before replaying the visual sequence.
      const ready=await Promise.all((Object.keys(levels) as Cue[]).map(async cue=>{
        let audio=players.get(cue);
        if(!audio){audio=new Audio(`/media/flow/${cue}.mp3`);audio.preload='auto';players.set(cue,audio);}
        audio.volume=0;
        try{await audio.play();audio.pause();audio.currentTime=0;audio.volume=levels[cue];return true;}
        catch{return false;}
      }));
      if(disposed||attempt!==revision){stop();return false;}
      enabled=ready.every(Boolean);
      if(!enabled)stop();
      return enabled;
    },
    disable(){revision++;enabled=false;stop();},
    play(cue:Cue,owner:string,duration?:number) {
      if(!enabled||disposed||document.hidden)return;
      const audio=players.get(cue)!;
      audio.pause();audio.currentTime=0;audio.volume=levels[cue];
      audio.playbackRate=duration&&Number.isFinite(audio.duration)?Math.min(3,Math.max(.65,audio.duration/duration)):1;
      owners.set(cue,owner);
      void audio.play().catch(()=>{owners.delete(cue);});
    },
    stop,
    dispose(){disposed=true;revision++;enabled=false;stop();players.forEach(audio=>{audio.removeAttribute('src');audio.load();});players.clear();},
  };
}
export type FlowSounds=ReturnType<typeof createFlowSounds>;
