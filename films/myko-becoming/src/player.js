/* Standalone accessible film player. ?render=1 stays inert for export tooling. */
(function () {
  'use strict';
  const F = window.FILM;
  if (!F || typeof F.renderFrame !== 'function') return;
  const params = new URLSearchParams(location.search);
  if (params.get('render') === '1') return;

  function start() {
    const loopShot = params.get('shot') ? F.shotById(params.get('shot')) : null;
    const a = loopShot ? loopShot.start : 0, b = loopShot ? loopShot.end : F.DURATION;
    const style = document.createElement('style');
    style.textContent = `
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#efe3c9;color:#34392f}
      body{font-family:Georgia,serif;padding:clamp(14px,3vw,48px);display:flex;justify-content:center}
      main{width:min(1400px,100%)}header{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:22px}
      h1{margin:0;font-size:clamp(24px,3vw,40px);font-weight:500;letter-spacing:.04em}header p{margin:0;font:12px/1.5 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#6b705a}
      .frame{position:relative;background:#27352d;border:1px solid #b8ac90;box-shadow:0 15px 45px #493f3026;border-radius:5px;overflow:hidden}
      canvas{display:block;width:100%;aspect-ratio:16/9;cursor:pointer}canvas:focus-visible{outline:4px solid #ad5f37;outline-offset:-4px}
      .controls{display:flex;align-items:center;gap:15px;padding:14px 0;flex-wrap:wrap;font:13px/1.4 system-ui,sans-serif}
      button{font:inherit;border:1px solid #aa9c7d;background:#f7edd9;color:#34392f;border-radius:30px;min-height:40px;padding:8px 18px;cursor:pointer}
      button:hover{background:#e6d5b4}button:focus-visible,input:focus-visible{outline:3px solid #ad5f37;outline-offset:3px}
      .primary{background:#3e503a;color:#faf2dd;border-color:#3e503a;min-width:108px}.primary:hover{background:#53684d}
      input[type=range]{flex:1;min-width:110px;accent-color:#7b8051;cursor:pointer}time{min-width:77px;font-variant-numeric:tabular-nums;color:#62664f}
      footer{display:flex;justify-content:space-between;gap:20px;padding-top:10px;border-top:1px solid #cfc0a2;color:#73765e;font-size:13px;line-height:1.6}
      .hint{font:12px/1.6 system-ui,sans-serif}body.playing header,body.playing footer{opacity:.65}
      @media(max-width:600px){header{display:block}header p{margin-top:8px;font-size:10px}.controls{gap:8px}.controls button{padding:8px 12px}footer{display:block}header{margin-bottom:14px}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
    `;
    document.head.append(style);
    document.title = 'Myko — What Decay Becomes';
    const main = document.createElement('main');
    main.innerHTML = `<header><h1>MYKO <span style="font-size:.55em;letter-spacing:0">— What Decay Becomes</span></h1><p>An illustrated little film · 36 seconds</p></header>
      <div class="frame"><canvas id="film" tabindex="0" role="button" aria-label="Play Myko’s film"></canvas></div>
      <div class="controls"><button class="primary" id="play" type="button">▶ Play film</button><input id="seek" type="range" min="${a}" max="${b}" step="${1/F.FPS}" value="${a}" aria-label="Film position"><time id="time">0:00 / 0:36</time><button id="sound" type="button" aria-pressed="true">Sound on</button><button id="restart" type="button">↺ Restart</button></div>
      <footer><span>A small encounter. A living world. A new beginning.</span><span class="hint">Space to play or pause · Arrow keys to step frames</span></footer>`;
    document.body.append(main);
    const canvas = document.getElementById('film'); F.mount(canvas);
    const playButton = document.getElementById('play'), seek = document.getElementById('seek');
    const soundButton = document.getElementById('sound'), time = document.getElementById('time');
    const supplied = Number(params.get('t'));
    let T = params.has('t') && Number.isFinite(supplied) ? Math.max(a,Math.min(b-1/F.FPS,supplied)) : a;
    let playing = false, sound = true, audio = null, rafStart = null, rafT = T, last = -1;
    const quant = t => Math.floor(t*F.FPS+1e-6)/F.FPS;
    const stamp = t => Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
    function draw(force) {
      const q = quant(Math.max(a,Math.min(T,b-1/F.FPS)));
      if (!force && q === last) return;
      last = q; F.errors = []; F.renderFrame(q);
      if (F.errors.length) console.warn('Film frame error',q,F.errors);
      seek.value = String(T); time.textContent = stamp(T-a)+' / '+stamp(b-a);
    }
    function stopAudio(){ if(audio){const ctx=audio.ctx;audio=null;ctx.close();} }
    function startAudio(){
      stopAudio();
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!sound||!AC||!F.audio)return;
      const ctx=new AC({latencyHint:'playback',sampleRate:48000});
      const anchor=ctx.currentTime;
      try {F.audio.render(ctx,{start:T,dest:ctx.destination});audio={ctx,anchor,from:T};ctx.resume();}
      catch(e){ctx.close();console.error('Could not play film audio',e);}
    }
    function updateUI(){
      document.body.classList.toggle('playing',playing);
      playButton.textContent=playing?'Ⅱ Pause':T>=b-1/F.FPS?'↺ Replay':'▶ Play film';
      canvas.setAttribute('aria-label',playing?'Pause Myko’s film':'Play Myko’s film');
    }
    function play(){if(T>=b-1/F.FPS)T=a;playing=true;rafStart=null;rafT=T;startAudio();updateUI();}
    function pause(){playing=false;stopAudio();T=quant(T);updateUI();draw(true);}
    function toggle(){playing?pause():play();}
    function reset(){const was=playing;pause();T=a;draw(true);if(was)play();else updateUI();}
    function tick(now){
      if(playing){
        if(audio){const latency=(audio.ctx.baseLatency||0)+(audio.ctx.outputLatency||0);T=audio.from+Math.max(0,audio.ctx.currentTime-audio.anchor-latency);}
        else{if(rafStart===null)rafStart=now;T=rafT+(now-rafStart)/1000;}
        if(T>=b){if(loopShot){T=a;startAudio();rafStart=now;rafT=T;}else{T=b;pause();}}
        draw(false);
      }
      requestAnimationFrame(tick);
    }
    playButton.addEventListener('click',toggle);canvas.addEventListener('click',toggle);
    document.getElementById('restart').addEventListener('click',reset);
    soundButton.addEventListener('click',()=>{sound=!sound;soundButton.textContent=sound?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(sound));if(playing){rafStart=null;rafT=T;startAudio();}});
    let seekPlaying=false;
    seek.addEventListener('pointerdown',()=>{seekPlaying=playing;if(playing)pause();});
    seek.addEventListener('input',()=>{if(playing)pause();T=Math.min(b-1/F.FPS,Number(seek.value));draw(true);updateUI();});
    seek.addEventListener('change',()=>{if(seekPlaying){seekPlaying=false;play();}});
    window.addEventListener('keydown',e=>{
      if(e.target===seek||e.target.tagName==='BUTTON')return;
      if(e.code==='Space'||(e.code==='Enter'&&e.target===canvas)){e.preventDefault();toggle();}
      else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();pause();T=Math.max(a,Math.min(b-1/F.FPS,T+(e.code==='ArrowRight'?1:-1)/F.FPS));draw(true);updateUI();}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
    draw(true);requestAnimationFrame(tick);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
