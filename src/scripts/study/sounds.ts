type LoopSound = 'fan' | 'mist';
type SwitchSound = 'light' | 'screen';

/** Local, pre-trimmed media. Sounds start only through a visitor's interaction. */
export function createStudySounds() {
  const clips = {
    fan: '/media/study/fan-loop.ogg',
    mist: '/media/study/humidifier-loop.ogg',
    light: '/media/study/light-switch.ogg',
    screen: '/media/study/screen-switch.ogg',
  };
  const players = new Map<keyof typeof clips, HTMLAudioElement>();
  let enabled = true;
  let activeLoop: LoopSound | null = null;
  let suspended = false;
  const player = (name: keyof typeof clips) => {
    if (!players.has(name)) {
      const audio = new Audio(clips[name]);
      audio.preload = 'none';
      audio.loop = name === 'fan' || name === 'mist';
      audio.volume = audio.loop ? .35 : .55;
      players.set(name, audio);
    }
    return players.get(name)!;
  };
  const play = (audio: HTMLAudioElement) => { void audio.play().catch(() => { /* Browser audio preferences leave the visual available. */ }); };
  function stopLoop() {
    if (activeLoop) { const audio=player(activeLoop); audio.pause(); audio.currentTime=0; }
    activeLoop=null;
  }
  return {
    loop(name: LoopSound) { stopLoop(); activeLoop=name; if (enabled&&!suspended) play(player(name)); },
    switch(name: SwitchSound) {
      // A component-list click can begin outside the canvas before it scrolls
      // into view. Its short switch feedback still belongs to that gesture.
      if (!enabled||document.hidden) return;
      const audio=player(name); audio.pause(); audio.currentTime=0; play(audio);
    },
    stopLoop,
    setEnabled(value: boolean) {
      enabled=value;
      if (!enabled) players.forEach(audio=>audio.pause());
      else if (activeLoop&&!suspended) play(player(activeLoop));
    },
    suspend(value: boolean) {
      if (suspended===value) return;
      suspended=value;
      if (suspended) players.forEach(audio=>audio.pause());
      else if (activeLoop&&enabled) play(player(activeLoop));
    },
    dispose() { activeLoop=null; players.forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load();});players.clear(); },
  };
}
