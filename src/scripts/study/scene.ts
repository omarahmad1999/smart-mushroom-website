import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from './hardware';
import { createTent } from './tent';
import { createCooler } from './cooler';
import { createDevices } from './devices';
import { createWorkbench } from './workbench';
import { createPeripherals } from './peripherals';
import { createWiring } from './wiring';
import { positions, add } from './layout';
import { createStudySounds } from './sounds';
import { components, componentById, categories, journeyNotes, tours, type Component, type TourRoute, type VisualAction } from './content';

type Region = 'overview' | 'tent' | 'workbench';
type Category = typeof categories[number];
/** Which numbered markers are shown: the five group markers, some groups, or every part. */
type Markers = { mode: 'groups' } | { mode: 'some'; show: Set<Category> } | { mode: 'every' };
const regionGroups: Record<Exclude<Region, 'overview'>, Category[]> = {
  tent: ['The habitat', 'Air & light', 'Observation'],
  workbench: ['The workbench', 'Power & wiring'],
};
type Demo = 'cooling' | 'fan' | 'mist' | 'light' | 'camera';
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function mountMaterialStudy(section: HTMLElement) {
  const viewport = section.querySelector<HTMLElement>('[data-study-viewport]')!;
  const fallback = section.querySelector<HTMLElement>('[data-study-fallback]')!;
  const status = section.querySelector<HTMLElement>('[data-study-status]')!;
  const detail = section.querySelector<HTMLElement>('[data-study-detail]')!;
  const actionButton = section.querySelector<HTMLButtonElement>('[data-study-action]')!;
  const screenPreview=section.querySelector<HTMLElement>('[data-study-screen-preview]')!;
  const sounds=createStudySounds();
  let soundEnabled=true;
  let screenOn=false;
  let screenTexture:THREE.Texture|null=null;
  const studyButtons = [...section.querySelectorAll<HTMLButtonElement>('button[disabled]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.dataset.studyCanvas = '';
  canvas.setAttribute('aria-label', 'Interactive mushroom tent and hardware workbench. Drag to rotate. Arrow keys turn the view; plus and minus zoom; Home resets. The component list provides the same explanations as clicking objects.');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context) throw new Error('WebGL 2 unavailable');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  viewport.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 50);
  const target = V(-.55, 1.65, 0);
  camera.layers.enable(1);
  const originalCamera = V(7.0, 7.8, 11.2);
  camera.position.copy(originalCamera);
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = !reduceMotion.matches;
  controls.dampingFactor = 0.16;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.48;
  controls.maxPolarAngle = 1.50;
  controls.rotateSpeed = 0.65;
  controls.autoRotateSpeed = 0.55;
  controls.cursorStyle = 'grab';
  canvas.style.touchAction = 'pan-y';
  controls.update();
  controls.saveState();

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.025);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.25;
  room.dispose();
  pmrem.dispose();
  const ambient = new THREE.HemisphereLight('#fff9e8', '#b4b295', 1.0);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff0d0', 2.5);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 22 });
  key.shadow.normalBias = 0.008;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 4;
  key.shadow.intensity = 0.65;
  key.target.position.set(0, 1.5, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#edf0e7', 0.4);
  fill.position.set(4, 4, -3);
  scene.add(fill);

  const world = new THREE.Group();
  scene.add(world);
  const tent = createTent();
  const devices = createDevices();
  const cooler = createCooler();
  const bench = createWorkbench();
  const peripherals = createPeripherals();
  const screenMaterial=peripherals.monitor.userData.screenMaterial as THREE.MeshBasicMaterial;
  const groups: Record<Component, THREE.Group> = {
    cooler:cooler.group,...peripherals,bag:tent.bags,bag2:tent.bag2,frame:tent.frame,cover:tent.cover,
    fan:devices.fan,vent:devices.vent,humidity:devices.humidity,duct:devices.duct,light:devices.light,
    camera:devices.camera,camera2:devices.camera2,sensor:devices.sensor,sht:devices.sht,
    pi:bench.pi,ai:bench.ai,mosfets:bench.mosfets,'mosfet-led':bench.mosfetLed,ups:bench.ups,ssd:bench.ssd,table:bench.furniture,
  };
  world.add(createStage(),...Object.values(groups));
  const wiring=createWiring();wiring.visible=false;world.add(wiring);
  // Each part gets its own copies of its lit materials, so it can be highlighted or faded
  // on its own. Effect materials (screen, airflow, mist, beams) stay shared and untouched.
  type PartMaterial = THREE.MeshStandardMaterial & { userData: { base: { opacity:number; transparent:boolean; depthWrite:boolean; emissive:THREE.Color; emissiveIntensity:number }; target?: number; from?: number } };
  const partMaterials=new Map<Component,PartMaterial[]>();
  const ownMaterials=(id:Component,root:THREE.Object3D)=>{
    const own=new Map<THREE.Material,PartMaterial>();
    root.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const swap=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        if(!own.has(material)){
          const copy=material.clone() as PartMaterial;
          copy.userData.base={opacity:copy.opacity,transparent:copy.transparent,depthWrite:copy.depthWrite,emissive:copy.emissive.clone(),emissiveIntensity:copy.emissiveIntensity};
          own.set(material,copy);
        }
        return own.get(material)!;
      };
      object.material=Array.isArray(object.material)?object.material.map(swap):swap(object.material);
    });
    partMaterials.set(id,[...(partMaterials.get(id)??[]),...own.values()]);
  };
  for(const [id,group] of Object.entries(groups) as [Component,THREE.Group][])ownMaterials(id,group);
  for(const owner of wiring.children)if(componentById[owner.userData.component as Component])ownMaterials(owner.userData.component as Component,owner);
  // Layer switches animate. The cover is cut by a plane that sweeps down (removing) or up
  // (replacing); wires draw along their own paths; mushroom caps grow from where they attach.
  renderer.localClippingEnabled=true;
  const coverCut=new THREE.Plane(V(0,-1,0),100);
  const coverOwn=new Map<THREE.Material,THREE.Material>();
  tent.cover.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const cut=(material:THREE.Material)=>{
      if(!coverOwn.has(material)){const copy=material instanceof THREE.MeshStandardMaterial?material:material.clone();copy.clippingPlanes=[coverCut];copy.needsUpdate=true;coverOwn.set(material,copy);}
      return coverOwn.get(material)!;
    };
    object.material=Array.isArray(object.material)?object.material.map(cut):cut(object.material);
  });
  const wireParts:{mesh:THREE.Mesh;count:number;delay:number;drawn:boolean}[]=[];
  wiring.traverse(object=>{if(object instanceof THREE.Mesh&&object.geometry.index)wireParts.push({mesh:object,count:object.geometry.index.count,delay:0,drawn:object.geometry.type==='TubeGeometry'||object.geometry.type==='BufferGeometry'});});
  wireParts.forEach((part,index)=>part.delay=index/wireParts.length*.4);
  const tentParts=[tent.frame,tent.cover,tent.bags,tent.bag2,devices.fan,devices.vent,devices.duct,devices.light,devices.camera,devices.camera2,devices.sensor,devices.sht];
  tentParts.forEach(group=>group.traverse(object=>object.layers.set(1)));
  const fanAirflow=devices.fan.getObjectByName('fan-airflow');
  const lightBeam=devices.light.getObjectByName('light-beam');
  // The LED lights only the tent layer, leaving the workbench and floor dim.
  const illustrativeLight=new THREE.SpotLight('#ffe6a6',0,6.5,.34,.62,1.5);
  illustrativeLight.position.set(.55,3.96,-.12);
  illustrativeLight.target.position.set(.55,.35,-.12);
  illustrativeLight.layers.set(1);
  const tentFill=new THREE.HemisphereLight('#ffefc6','#948364',0);tentFill.layers.set(1);
  world.add(illustrativeLight,illustrativeLight.target,tentFill);
  // A soft additive glow around the LED strip, drawn with the tent's own lighting pass.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const glowPaint=glowCanvas.getContext('2d')!,glowGradient=glowPaint.createRadialGradient(64,64,0,64,64,64);
  glowGradient.addColorStop(0,'rgba(255,238,196,.95)');glowGradient.addColorStop(.28,'rgba(255,222,156,.42)');glowGradient.addColorStop(1,'rgba(255,214,146,0)');
  glowPaint.fillStyle=glowGradient;glowPaint.fillRect(0,0,128,128);
  const ledGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,toneMapped:false}));
  ledGlow.position.set(.55,3.96,-.12);ledGlow.scale.set(1.7,.85,1);ledGlow.visible=false;ledGlow.layers.set(1);ledGlow.userData.ignorePicking=true;
  world.add(ledGlow);
  const litFloor=new THREE.Mesh(new THREE.PlaneGeometry(1.68,1.12),new THREE.MeshStandardMaterial({color:'#dddfca',roughness:.93}));
  litFloor.rotation.x=-Math.PI/2;litFloor.position.set(.55,.144,-.12);litFloor.layers.set(1);litFloor.visible=false;world.add(litFloor);
  const caps:{object:THREE.Object3D;scale:THREE.Vector3;delay:number;growth:number}[]=[];
  const emitterIntensities=devices.lightEmitters.map(mesh=>(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity);
  const mushroomGroups:THREE.Object3D[]=[];
  for(const bag of [tent.bags,tent.bag2]) bag.traverse(object=>{if(object.userData.mushrooms||object.name==='oyster-clusters')mushroomGroups.push(object);});
  // Each oyster cluster grows as one piece from where it attaches to the bag.
  let clusterIndex=0;
  for(const group of mushroomGroups)for(const cluster of group.children){caps.push({object:cluster,scale:cluster.scale.clone(),delay:(clusterIndex%3)/3*.4+Math.floor(clusterIndex/3)*.08,growth:1});clusterIndex++;}
  [devices.mist,devices.cameraField,devices.cameraField2,fanAirflow,lightBeam].forEach(object=>{if(object)object.userData.ignorePicking=true;});

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ color: '#8e8061', opacity: 0.20 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.044;
  floor.receiveShadow = true;
  scene.add(floor);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(82,75,54,0.23)');
  gradient.addColorStop(0.55, 'rgba(82,75,54,0.13)');
  gradient.addColorStop(1, 'rgba(82,75,54,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const softShadow = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 5.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false }));
  softShadow.rotation.x = -Math.PI / 2;
  softShadow.position.set(-.55,-.042,-.55);
  scene.add(softShadow);

  let alive = true;
  let inView = false;
  let animationFrame = 0;
  let renderingFrame = false;
  let keepMovingUntil = 0;
  let lastFrame = 0;
  let selected: Component = 'bag';
  let labelsVisible = true;
  let hovered: Component | null = null;
  let fading = false;
  let mushroomsVisible = true;
  let growthOpen = false;
  let tour: { route: TourRoute; index: number; playing: boolean; timer: number; wiringBefore: boolean } | null = null;
  let touring = false;
  const pulses: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number; reverse: boolean }[] = [];
  let coverOn = tent.cover.visible, wiringOn = wiring.visible;
  let layerMotion: { layer: 'cover' | 'wiring' | 'mushrooms'; on: boolean; start: number; duration: number } | null = null;
  const demos=new Set<Demo>();
  let demoStarted = 0;
  let tween: { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromZoom: number; toZoom: number } | null = null;
  const buildOrder=[tent.frame,bench.furniture,...Object.values(groups).filter(group=>group!==tent.frame&&group!==bench.furniture&&group!==tent.cover),tent.cover,wiring];
  let assembly: { start: number; saved: { object: THREE.Object3D; position: THREE.Vector3; visible: boolean }[] } | null = null;
  const cleanup = new AbortController();
  const eventOptions = { signal: cleanup.signal };
  const leaderLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');
  leaderLayer.dataset.studyLeaders='';leaderLayer.setAttribute('aria-hidden','true');viewport.append(leaderLayer);
  const hoverLabel=document.createElement('span');hoverLabel.className='ms-hover-label';hoverLabel.setAttribute('aria-hidden','true');hoverLabel.hidden=true;viewport.append(hoverLabel);
  let markers:Markers={mode:'groups'};
  let everyPart=false;
  const markerShown=(category:Category)=>everyPart||markers.mode==='every'||(markers.mode==='some'&&markers.show.has(category));
  const hotspots=components.map(item=>{
    const id=item.id;
    const button=document.createElement('button');button.type='button';button.dataset.studyHotspot=id;button.dataset.label=item.label;
    button.setAttribute('aria-label',`Inspect ${item.label}`);button.setAttribute('aria-controls','study-component-detail');
    button.setAttribute('aria-pressed',String(id===selected));button.textContent=item.number;
    button.addEventListener('click',()=>select(id),eventOptions);viewport.append(button);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.dataset.studyLeader=id;leaderLayer.append(line);
    const offset = id==='table'?[-1.45,.04,.65]:id==='monitor'?[0,.63,.035]:id==='humidity'?[0,.50,.27]
      :id==='cobbler'?[-.19,.054,0]:id==='pi'?[0,.05,.10]:id==='ai'?[0,.034,0]
      :id==='ups'?[0,.08,.22]:id.startsWith('wago-')?[0,.04,0]:[0,0,0];
    return {id,button,line,category:item.category as Category,anchor:V(...add(positions[id],offset as [number,number,number]))};
  });
  // Group markers name the five parts of the setup. Each sits at the middle of its parts.
  const groupMarkers=categories.map(category=>{
    const members=hotspots.filter(hotspot=>hotspot.category===category);
    const anchor=members.reduce((sum,member)=>sum.add(member.anchor),V(0,0,0)).multiplyScalar(1/members.length);
    const button=document.createElement('button');button.type='button';button.className='ms-group-marker';button.dataset.studyGroup=category;
    button.innerHTML=`<span></span><b aria-hidden="true">${members.length}</b>`;button.querySelector('span')!.textContent=category;
    button.setAttribute('aria-label',`${category}: ${members.length} parts. Show their markers`);
    button.addEventListener('click',()=>openGroup(category),eventOptions);viewport.append(button);
    return {category,button,anchor,members};
  });

  function draw() {
    if (!alive || viewport.clientWidth === 0) return;
    // PointsMaterial uses pixel units with an orthographic camera. Preserve a
    // soft plume of world-sized particles through zoom and responsive resizing.
    (devices.mist.material as THREE.PointsMaterial).size=.23*viewport.clientHeight*camera.zoom/(camera.top-camera.bottom);
    cooler.plumeMaterial.size=.18*viewport.clientHeight*camera.zoom/(camera.top-camera.bottom);
    if(demos.has('light')) {
      // Separate render passes keep tent lights from illuminating the workbench.
      camera.layers.set(0);renderer.render(scene,camera);
      renderer.autoClear=false;camera.layers.set(1);renderer.render(scene,camera);
      renderer.autoClear=true;camera.layers.enable(0);
    } else {
      camera.layers.set(0);camera.layers.enable(1);renderer.render(scene,camera);
    }
    const used:THREE.Vector2[]=[];
    const width=viewport.clientWidth,height=viewport.clientHeight;
    leaderLayer.setAttribute('viewBox',`0 0 ${width} ${height}`);
    // Markers step aside while the tent is lit, so the light itself is the subject.
    const lit=demos.has('light')||growthOpen;
    const groupsShown=labelsVisible&&!assembly&&!lit&&!everyPart&&markers.mode==='groups';
    for(const {button,anchor} of groupMarkers) {
      const p=anchor.clone().project(camera);
      const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
      button.hidden=!groupsShown||x<0||x>width||y<0||y>height;
      if(button.hidden)continue;
      const half=button.offsetWidth/2+6;
      const candidates=[new THREE.Vector2(THREE.MathUtils.clamp(x,half,width-half),THREE.MathUtils.clamp(y,24,height-24))];
      for(let ring=1;ring<=6;ring++) for(let turn=0;turn<12;turn++) candidates.push(new THREE.Vector2(x+Math.cos(turn*Math.PI/6)*ring*28,y+Math.sin(turn*Math.PI/6)*ring*22));
      const fits=(point:THREE.Vector2)=>point.x>=half&&point.x<=width-half&&point.y>=24&&point.y<=height-24&&!used.some(other=>Math.abs(other.x-point.x)<half*1.6&&Math.abs(other.y-point.y)<38);
      const point=candidates.find(fits)??candidates[0];used.push(point);
      button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;
    }
    for(const {button,line,anchor,category} of [...hotspots].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected))) {
      const p=anchor.clone().project(camera);
      const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
      const outside=x<0||x>width||y<0||y>height||p.z<-1||p.z>1;
      button.hidden=!labelsVisible||!!assembly||lit||outside||!markerShown(category);
      line.style.display=button.hidden?'none':'';
      if(button.hidden)continue;
      const candidates=[new THREE.Vector2(THREE.MathUtils.clamp(x,23,width-23),THREE.MathUtils.clamp(y,23,height-23))];
      // Every item keeps its indicator. Move crowded markers, with a fine leader
      // back to the object, instead of silently hiding small hardware.
      for(let ring=1;ring<=8;ring++) for(let turn=0;turn<16;turn++) {
        const angle=turn*Math.PI/8, radius=ring*32;
        candidates.push(new THREE.Vector2(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius));
      }
      const fits=(point:THREE.Vector2)=>point.x>=23&&point.x<=width-23&&point.y>=23&&point.y<=height-23
        && !used.some(other=>other.distanceTo(point)<43)
        && !(width>700&&(!detail.hidden||!tourCard.hidden)&&point.x>width-316&&point.y<Math.max(detail.offsetHeight,tourCard.offsetHeight)+24);
      const point=candidates.find(fits)??candidates[0];used.push(point);
      button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;
      line.setAttribute('x1',String(x));line.setAttribute('y1',String(y));line.setAttribute('x2',String(point.x));line.setAttribute('y2',String(point.y));
      line.style.opacity=point.distanceTo(new THREE.Vector2(x,y))>18?(button.dataset.studyHotspot===selected?'.42':'.22'):'0';
    }
    section.dataset.studyView = `${controls.getAzimuthalAngle().toFixed(3)},${controls.getPolarAngle().toFixed(3)},${camera.zoom.toFixed(2)}`;
  }

  function finishAssembly() {
    if (!assembly) return;
    for (const saved of assembly.saved) { saved.object.position.copy(saved.position); saved.object.visible = saved.visible; }
    assembly = null;
    renderer.shadowMap.needsUpdate = true;
    section.dataset.studyBuild = 'idle';
    section.querySelector('[data-study-build]')?.setAttribute('aria-pressed', 'false');
  }

  function syncDemos() {
    section.dataset.studyDemo=[...demos].join(' ')||'none';
    for(const [id,action] of [['cooler','cooling'],['fan','fan'],['humidity','mist'],['light','light']] as const){
      section.dataset[`study${action[0].toUpperCase()+action.slice(1)}Active`]=String(demos.has(action));
      section.querySelectorAll<HTMLElement>(`[data-study-hotspot="${id}"],[data-study-select="${id}"]`).forEach(button=>{
        button.dataset.deviceActive=String(demos.has(action));
        button.setAttribute('aria-description',demos.has(action)?'Illustration switched on':'Illustration switched off');
      });
    }
    syncAction();
  }
  function stopDemo(action?:Demo) {
    const stop=(name:Demo)=>!action||action===name;
    if(action)demos.delete(action);else demos.clear();
    if(stop('fan')){sounds.stopLoop('fan');if(fanAirflow){fanAirflow.visible=false;fanAirflow.position.y=0;}}
    if(stop('cooling')){sounds.stopLoop('cooling');cooler.airflow.visible=false;}
    if(stop('mist')){sounds.stopLoop('mist');devices.mist.visible=false;}
    if(stop('camera'))devices.cameraField.visible=devices.cameraField2.visible=false;
    if(stop('light')){
      if(lightBeam)lightBeam.visible=false;
      illustrativeLight.intensity=tentFill.intensity=0;litFloor.visible=false;ledGlow.visible=false;
      dayLight();
      renderer.setClearColor(0x000000,0);section.dataset.studyLighting='day';
      devices.lightEmitters.forEach((mesh,index)=>{(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity=emitterIntensities[index];});
    }
    syncDemos();
  }

  function updateDemo(now: number, dt: number) {
    if (!demos.size) return;
    const elapsed = (now - demoStarted) / 1000;
    if (reduceMotion.matches) return;
    if (demos.has('cooling')) cooler.animate(elapsed);
    if (demos.has('fan')) {
      devices.fanRotor.rotation.y += dt * 7.5;
      if (fanAirflow) fanAirflow.position.y = Math.sin(elapsed * 3) * 0.045;
    }
    if (demos.has('mist')) {
      const positions = devices.mist.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const phase=(elapsed*.24+i/positions.count)%1, angle=i*2.39996+elapsed*.16;
        positions.setXYZ(i,1.205-phase*1.02,3.09-phase*.18+Math.sin(angle)*(.02+phase*.19),-.15+Math.cos(angle)*(.015+phase*.28));
      }
      positions.needsUpdate = true;
    }
  }

  function loop(now: number) {
    animationFrame = 0;
    if (!alive || !inView || document.hidden) return;
    renderingFrame = true;
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;
    if (tween) {
      const progress = Math.min((now - tween.start) / 700, 1);
      const eased = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(tween.from, tween.to, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      camera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.toZoom, eased);
      camera.updateProjectionMatrix();
      if (progress === 1) tween = null;
    }
    if (assembly) {
      const elapsed = now - assembly.start;
      assembly.saved.forEach((saved, index) => {
        const phase = THREE.MathUtils.clamp((elapsed - index * 80) / 650, 0, 1);
        saved.object.visible = saved.visible && phase > 0;
        saved.object.position.copy(saved.position);
        saved.object.position.y += 0.40 * (1 - phase) ** 3;
      });
      renderer.shadowMap.needsUpdate = true;
      if (elapsed > assembly.saved.length*80+650) { finishAssembly(); status.textContent = 'The habitat is assembled. Select any component to explore.'; }
    }
    updateDemo(now, dt);
    if (fading) stepFade(now);
    if (pulses.length && !reduceMotion.matches) for (const pulse of pulses) {
      const u = (now / 1000 * .42 + pulse.offset) % 1;
      pulse.mesh.position.copy(pulse.curve.getPointAt(pulse.reverse ? 1 - u : u));
    }
    if (layerMotion) stepLayers(now);
    controls.update(dt);
    draw();
    renderingFrame = false;
    const animatedDemo = !reduceMotion.matches && (demos.has('fan') || demos.has('mist') || demos.has('cooling'));
    if (tween || assembly || animatedDemo || fading || (pulses.length > 0 && !reduceMotion.matches) || layerMotion || controls.autoRotate || now < keepMovingUntil) animationFrame = requestAnimationFrame(loop);
  }
  function wake(duration = 500) {
    keepMovingUntil = Math.max(keepMovingUntil, performance.now() + duration);
    if (!animationFrame && !renderingFrame && inView && !document.hidden) animationFrame = requestAnimationFrame(loop);
  }
  function moveTo(newTarget: THREE.Vector3, zoom: number, position?: THREE.Vector3) {
    const nextPosition = position ?? newTarget.clone().add(camera.position.clone().sub(controls.target));
    if (reduceMotion.matches) {
      camera.position.copy(nextPosition); controls.target.copy(newTarget); camera.zoom = zoom;
      camera.updateProjectionMatrix(); controls.update(); tween = null; draw();
    } else { tween = { start: performance.now(), from: camera.position.clone(), to: nextPosition, fromTarget: controls.target.clone(), toTarget: newTarget, fromZoom: camera.zoom, toZoom: zoom }; wake(750); }
  }
  /** Fades every part outside `parts` back, leaving the chosen parts in full colour. */
  let fadeStart = 0;
  function setFocus(parts: Component[] | null) {
    const keep = parts ? new Set(parts) : null;
    for (const [id, materials] of partMaterials) {
      const faded = !!keep && !keep.has(id);
      for (const material of materials) {
        const base = material.userData.base;
        material.userData.from = material.opacity;
        material.userData.target = faded ? base.opacity * .16 : base.opacity;
        if (faded) { material.transparent = true; material.depthWrite = false; }
      }
    }
    // The monitor's screen keeps its shared material, so it fades with the monitor here.
    const screenFaded = !!keep && !keep.has('monitor');
    screenMaterial.transparent = screenFaded; screenMaterial.opacity = screenFaded ? .16 : 1; screenMaterial.depthWrite = !screenFaded;
    section.dataset.studyFocus = parts ? parts.join(' ') : 'none';
    fadeStart = performance.now(); fading = true;
    if (reduceMotion.matches) stepFade(fadeStart + 1e4); else wake();
  }
  /** A short, time-based fade: it finishes on schedule however slowly frames are drawn. */
  function stepFade(now: number) {
    const k = Math.min(1, (now - fadeStart) / 280), eased = 1 - (1 - k) ** 3;
    for (const materials of partMaterials.values()) for (const material of materials) {
      const base = material.userData.base, target = material.userData.target ?? base.opacity, from = material.userData.from ?? target;
      material.opacity = from + (target - from) * eased;
      if (k >= 1 && target === base.opacity) { material.transparent = base.transparent; material.depthWrite = base.depthWrite; }
    }
    fading = k < 1;
  }
  /** Warms a part under the pointer and names it beside the cursor. */
  function setHover(id: Component | null, x = 0, y = 0) {
    if (id !== hovered) {
      for (const material of hovered ? partMaterials.get(hovered) ?? [] : []) { material.emissive.copy(material.userData.base.emissive); material.emissiveIntensity = material.userData.base.emissiveIntensity; }
      for (const material of id ? partMaterials.get(id) ?? [] : []) { material.emissive.set('#e2b25e'); material.emissiveIntensity = material.userData.base.emissiveIntensity + .26; }
      hovered = id; canvas.style.cursor = id ? 'pointer' : '';
      hoverLabel.hidden = !id; if (id) hoverLabel.textContent = componentById[id].label;
      draw();
    }
    if (id) hoverLabel.style.translate = `${x + 14}px ${y + 16}px`;
  }
  const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const overshoot = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
  function showLayer(layer: 'cover' | 'wiring' | 'mushrooms', on: boolean, t: number) {
    const shown = on ? t : 1 - t;
    if (layer === 'cover') {
      tent.cover.visible = on || t < 1;
      coverCut.constant = shown >= 1 ? 100 : .08 + ease(shown) * 4.35;
    }
    if (layer === 'wiring') {
      wiring.visible = on || t < 1;
      for (const part of wireParts) {
        const local = THREE.MathUtils.clamp((shown - part.delay) / .6, 0, 1);
        if (part.drawn) part.mesh.geometry.setDrawRange(0, local >= 1 ? Infinity : Math.floor(part.count * ease(local) / 3) * 3);
        else part.mesh.visible = local > .92;
      }
    }
    if (layer === 'mushrooms') {
      mushroomGroups.forEach(object => object.visible = on || t < 1);
      for (const cap of caps) {
        const local = THREE.MathUtils.clamp((shown - cap.delay) / .55, 0, 1);
        cap.object.scale.copy(cap.scale).multiplyScalar(Math.max(.0001, cap.growth * (on ? (local >= 1 ? 1 : overshoot(local)) : local)));
      }
    }
  }
  function animateLayer(layer: 'cover' | 'wiring' | 'mushrooms', on: boolean) {
    settleLayers();
    if (reduceMotion.matches) { showLayer(layer, on, 1); return; }
    const duration = layer === 'cover' ? 850 : layer === 'wiring' ? (on ? 1500 : 450) : (on ? 1100 : 380);
    layerMotion = { layer, on, start: performance.now(), duration };
    showLayer(layer, on, 0); wake(duration + 60);
  }
  function stepLayers(now: number) {
    const motion = layerMotion!, t = Math.min(1, (now - motion.start) / motion.duration);
    showLayer(motion.layer, motion.on, t);
    if (t >= 1) { layerMotion = null; renderer.shadowMap.needsUpdate = true; }
  }
  function settleLayers() { if (layerMotion) { showLayer(layerMotion.layer, layerMotion.on, 1); layerMotion = null; renderer.shadowMap.needsUpdate = true; } }
  // Guided tours: each step frames a part, fades the rest, runs its demonstration and sends
  // illustrative pulses along its wires in the direction the signal travels.
  const connections = wiring.userData.connections as { owner: Component; points: [number, number, number][] }[];
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });
  const pulseGeometry = new THREE.SphereGeometry(.022, 12, 8);
  function clearPulses() { pulses.splice(0).forEach(pulse => world.remove(pulse.mesh)); }
  function addPulses(owners: Component[], reverse: Component[]) {
    for (const connection of connections) {
      if (!owners.includes(connection.owner) || connection.points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(connection.points.map(point => V(...point)));
      for (const offset of [0, .5]) {
        const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial); mesh.layers.enable(1); mesh.userData.ignorePicking = true;
        mesh.position.copy(curve.getPointAt(offset)); world.add(mesh);
        pulses.push({ mesh, curve, offset, reverse: reverse.includes(connection.owner) });
      }
    }
    pulses.forEach(pulse => pulse.mesh.visible = !reduceMotion.matches);
  }
  function startTour(route: TourRoute) {
    closeMenus(); finishAssembly(); stopRotation();
    if (tour) endTour(false);
    tour = { route, index: 0, playing: !reduceMotion.matches, timer: 0, wiringBefore: wiringOn };
    if (!wiringOn) setLayer('wiring');
    section.dataset.studyTour = route; tourCard.hidden = false;
    showStep(0);
    tourCard.querySelector<HTMLElement>('[data-study-tour-next]')?.focus({ preventScroll: true });
  }
  function showStep(index: number) {
    if (!tour) return;
    const steps = tours[tour.route].steps;
    tour.index = THREE.MathUtils.clamp(index, 0, steps.length - 1);
    const step = steps[tour.index];
    clearTimeout(tour.timer); clearPulses(); stopDemo();
    touring = true; select(step.component); touring = false;
    detail.hidden = true;
    if (step.demo) runAction();
    if (step.demo !== 'light') setFocus([step.component, ...(step.also ?? [])]);
    addPulses(step.wires ?? [], step.reverse ?? []);
    tourCard.querySelector('[data-study-tour-route]')!.textContent = `${tours[tour.route].name} tour`;
    tourCard.querySelector('[data-study-tour-count]')!.textContent = `${tour.index + 1} of ${steps.length}`;
    tourCard.querySelector('[data-study-tour-title]')!.textContent = step.title;
    tourCard.querySelector('[data-study-tour-text]')!.textContent = step.text;
    const link = tourCard.querySelector<HTMLAnchorElement>('[data-study-tour-link]')!;
    link.hidden = !step.link; if (step.link) { link.href = step.link; link.textContent = `${step.linkLabel} ↗`; }
    tourCard.querySelectorAll('[data-study-tour-dot]').forEach((dot, i) => dot.toggleAttribute('data-current', i === tour!.index));
    (tourCard.querySelector('[data-study-tour-prev]') as HTMLButtonElement).disabled = tour.index === 0;
    (tourCard.querySelector('[data-study-tour-next]') as HTMLButtonElement).textContent = tour.index === steps.length - 1 ? 'Finish' : 'Next';
    section.dataset.studyTourStep = String(tour.index + 1);
    status.textContent = `${tours[tour.route].name} tour, step ${tour.index + 1} of ${steps.length}: ${step.title}.`;
    scheduleStep();
  }
  function scheduleStep() {
    if (!tour) return;
    clearTimeout(tour.timer);
    const play = tourCard.querySelector('[data-study-tour-play]')!;
    play.setAttribute('aria-pressed', String(tour.playing)); play.textContent = tour.playing ? 'Pause' : 'Play';
    if (tour.playing) tour.timer = window.setTimeout(() => nextStep(), 5200 + tours[tour!.route].steps[tour!.index].text.length * 28);
  }
  function nextStep() {
    if (!tour) return;
    if (tour.index >= tours[tour.route].steps.length - 1) { endTour(true); return; }
    showStep(tour.index + 1);
  }
  function endTour(reset = true) {
    if (!tour) return;
    const finished = tour; tour = null;
    clearTimeout(finished.timer); clearPulses(); stopDemo();
    if (!finished.wiringBefore && wiringOn) setLayer('wiring');
    tourCard.hidden = true; section.dataset.studyTour = 'none'; delete section.dataset.studyTourStep;
    if (reset) { regionView('overview'); status.textContent = `${tours[finished.route].name} tour finished.`; }
  }
  // Growth stages: an illustration of incubation, pinning, fruiting and harvest. The straw
  // substrate whitens as mycelium spreads, pins appear, clusters grow, then are harvested.
  const stageNames = ['Incubation', 'Pinning', 'Fruiting', 'Harvest'] as const;
  let substrates: THREE.MeshStandardMaterial[] | null = null;
  const straw = new THREE.Color('#c29a55'), colonised = new THREE.Color('#ffffff'), spent = new THREE.Color('#d8cfbb');
  function capGrowth(stage: number, delay: number) {
    const t = stage - delay * .35;
    if (t < .62) return 0;
    if (t < 1) return (t - .62) / .38 * .32;
    if (t < 2) return .32 + (t - 1) * .68;
    if (stage < 2.55) return 1;
    return Math.max(0, 1 - (stage - 2.55) / .4);
  }
  function applyGrowth(stage: number) {
    substrates ??= [tent.bags, tent.bag2].flatMap(bag => { const found: THREE.MeshStandardMaterial[] = []; bag.traverse(object => { if (object instanceof THREE.Mesh && object.name === 'colonized-substrate') found.push(object.material as THREE.MeshStandardMaterial); }); return found; });
    const colour = straw.clone().lerp(colonised, THREE.MathUtils.clamp(stage, 0, 1));
    if (stage > 2.55) colour.lerp(spent, Math.min(1, (stage - 2.55) / .45));
    substrates.forEach(material => material.color.copy(colour));
    for (const cap of caps) {
      cap.growth = capGrowth(stage, cap.delay);
      cap.object.scale.copy(cap.scale).multiplyScalar(Math.max(.0001, cap.growth * (mushroomsVisible ? 1 : 0)));
    }
    const nearest = stageNames[Math.round(THREE.MathUtils.clamp(stage, 0, 3))];
    growthRange.setAttribute('aria-valuetext', nearest);
    growthPanel.querySelectorAll<HTMLElement>('[data-study-growth-mark]').forEach(mark => mark.toggleAttribute('data-current', mark.dataset.studyGrowthMark === nearest));
    section.dataset.studyGrowth = nearest.toLowerCase();
    renderer.shadowMap.needsUpdate = true; draw();
  }
  function openGrowth() {
    closeMenus(); if (tour) endTour(false);
    growthPanel.hidden = false; growthOpen = true; growthRange.value = '2'; applyGrowth(2);
    const bags = [tent.bags, tent.bag2]; frame(bags, 1.6); setFocus(['bag', 'bag2']);
    status.textContent = 'Growth stages shown. Slide from incubation to harvest.';
    growthRange.focus({ preventScroll: true });
  }
  function closeGrowth() {
    if (growthPanel.hidden) return;
    growthPanel.hidden = true; growthOpen = false; applyGrowth(2); setFocus(null); delete section.dataset.studyGrowth;
    status.textContent = 'Growth stages closed. The fruiting illustration is shown.';
  }
  // Sketch style: materials are tinted toward paper and flattened in place (so highlighting
  // and fading keep working), and hard-edged parts gain ink edge lines.
  let sketch = false, edgesBuilt = false;
  const sketchStore = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; roughness: number; metalness: number; envMapIntensity: number }>();
  const edgeLines: THREE.LineSegments[] = [];
  const ink = new THREE.LineBasicMaterial({ color: '#3b3a31', transparent: true, opacity: .72 });
  const paperTone = new THREE.Color('#f5f1e4');
  function dayLight() {
    ambient.intensity = sketch ? 1.45 : 1; key.intensity = sketch ? 1.5 : 2.5; fill.intensity = sketch ? .2 : .4;
    scene.environmentIntensity = sketch ? 0 : .25; key.shadow.intensity = sketch ? .28 : .65;
  }
  function setSketch(on: boolean) {
    sketch = on;
    world.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (!sketchStore.has(material)) sketchStore.set(material, { color: material.color.clone(), roughness: material.roughness, metalness: material.metalness, envMapIntensity: material.envMapIntensity });
        const base = sketchStore.get(material)!;
        if (on) { material.color.copy(paperTone).lerp(base.color, .22); material.roughness = 1; material.metalness = 0; material.envMapIntensity = 0; }
        else { material.color.copy(base.color); material.roughness = base.roughness; material.metalness = base.metalness; material.envMapIntensity = base.envMapIntensity; }
      }
    });
    if (on && !edgesBuilt) {
      edgesBuilt = true;
      const meshes: THREE.Mesh[] = [];
      world.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      for (const mesh of meshes) {
        const geometry = mesh.geometry, material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
        // Cables, ducts and organic shapes would become noise; draw edges on hard parts only.
        // See-through film and glass, and instanced straw (one shape drawn many times), would
        // draw stray lines, so they stay plain.
        if (mesh instanceof THREE.InstancedMesh || mesh.userData.ignorePicking || !(material instanceof THREE.MeshStandardMaterial) || (material.userData.base?.transparent ?? material.transparent) || geometry.type === 'TubeGeometry' || triangles > 9000) continue;
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 26), ink);
        lines.raycast = () => {}; lines.layers.mask = mesh.layers.mask; lines.userData.ignorePicking = true;
        mesh.add(lines); edgeLines.push(lines);
      }
    }
    edgeLines.forEach(lines => lines.visible = on);
    if (!demos.has('light')) dayLight();
    section.dataset.studySketch = String(on);
    section.querySelector('button[data-study-sketch]')?.setAttribute('aria-pressed', String(on));
    syncLayerCount(); renderer.shadowMap.needsUpdate = true; draw();
    status.textContent = on ? 'Sketch style: the habitat is drawn in ink on paper.' : 'Rendered style restored.';
  }
  function stopRotation() { controls.autoRotate = false; section.querySelector('[data-study-rotate]')?.setAttribute('aria-pressed', 'false'); }
  function setRegionState(region: string) {
    section.dataset.studyRegion = region;
    section.querySelectorAll<HTMLElement>('button[data-study-region]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studyRegion === region)));
  }
  function regionView(region: Region, scroll = true) {
    if (tour && !touring) endTour(false);
    finishAssembly(); stopRotation(); detail.hidden = true; setRegionState(region);
    markers=region==='overview'?{mode:'groups'}:{mode:'some',show:new Set(regionGroups[region])};
    setFocus(null);
    if (region === 'overview') moveTo(target.clone(), 1, originalCamera.clone());
    if (region === 'tent') moveTo(V(0.55, 2.12, -0.12), viewport.clientWidth < 700 ? 2.20 : 1.40, V(6.1, 6.2, 9.1));
    if (region === 'workbench') moveTo(V(-2.40, 1.31, .02), viewport.clientWidth < 700 ? 2.0 : 1.8, V(2.5, 6.5, 8.2));
    status.textContent = region === 'overview' ? 'View reset. The whole setup is shown.' : region === 'tent' ? 'A closer view inside the tent.' : 'A closer view of the computing workbench.';
    // On mobile the inspector sits below the model. Restore its visibility so
    // the camera transition can resume when Reset is used from below the card.
    if (scroll) viewport.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  }
  function setScreen(on:boolean, audible=true) {
    screenOn=on;
    if(on&&!screenTexture) {
      screenTexture=new THREE.TextureLoader().load('/media/study/grafana-mockup.svg',texture=>{
        if(!alive){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        if(screenOn){screenMaterial.map=texture;screenMaterial.needsUpdate=true;draw();}
      });
      screenTexture.colorSpace=THREE.SRGBColorSpace;
    }
    screenMaterial.map=on?screenTexture:null;
    screenMaterial.color.set(on?'#ffffff':'#14221f');screenMaterial.needsUpdate=true;
    section.dataset.studyScreen=on?'on':'off';
    screenPreview.hidden=selected!=='monitor'||!on;
    if(audible)sounds.switch('screen');
    syncAction();draw();
  }
  function syncAction() {
    const action = componentById[selected].action;
    const active = action === 'mushrooms' ? mushroomsVisible : action === 'cover' ? coverOn : action === 'wiring' ? wiringOn : action === 'screen' ? screenOn : demos.has(action as Demo);
    const labels: Record<VisualAction, [string, string]> = {
      mushrooms: ['Show illustrated mushrooms', 'Hide illustrated mushrooms'], cover: ['Show the covering', 'Remove the covering'], wiring: ['Show the connections', 'Hide the connections'],
      cooling: ['Turn cooler on', 'Turn cooler off'],
      screen: ['Turn screen on', 'Turn screen off'], fan: ['Turn fan on', 'Turn fan off'], mist: ['Turn humidifier on', 'Turn humidifier off'], light: ['Show the lighting', 'Return to natural light'], camera: ['Show the camera view', 'Hide the camera view'],
    };
    actionButton.dataset.studyAction = action;
    actionButton.setAttribute('aria-pressed', String(active));
    section.querySelector<HTMLElement>('[data-study-action-label]')!.textContent = labels[action][Number(active)];
  }
  function focusComponent(id: Component) {
    const item = componentById[id];
    const focus = V(item.focus[0], item.focus[1], item.focus[2]);
    // Shift the focused object away from the desktop explanation card.
    if (viewport.clientWidth > 700) {
      const right = V(1, 0, 0).applyQuaternion(camera.quaternion);
      focus.addScaledVector(right, 0.38);
    }
    const overhead=['mosfets','mosfet-led','breadboard','cobbler','keyboard','mouse','ssd','adapter12','adapter24','power-strip'].includes(id)||id.startsWith('wago-');
    const zoomTo=item.zoom*(viewport.clientWidth<700?1.20:1);
    // On phones the explanation rises as a sheet over the lower scene; lift the part above it.
    if (viewport.clientWidth <= 700) focus.addScaledVector(V(0,1,0).applyQuaternion(camera.quaternion), -.34*(camera.top-camera.bottom)/zoomTo);
    moveTo(focus,zoomTo,id==='cooler'?focus.clone().add(V(-4,2.4,8)):id==='monitor'?focus.clone().add(V(.15,.65,5.5)):overhead?focus.clone().add(V(0,5.2,2.8)):undefined);
  }
  function select(id: Component, fromList = false) {
    if (!alive || !componentById[id]) return;
    if (tour && !touring) endTour(false);
    finishAssembly(); stopRotation(); selected = id;
    const item = componentById[id];
    if(markers.mode!=='some'||!markers.show.has(item.category as Category))markers={mode:'some',show:new Set([item.category as Category])};
    section.dataset.studySelected = id;
    setRegionState('component');
    section.querySelector<HTMLElement>('[data-study-detail-category]')!.textContent = `${item.category.toUpperCase()} / ${item.number}`;
    section.querySelector<HTMLElement>('[data-study-detail-title]')!.textContent = item.title;
    section.querySelector<HTMLElement>('[data-study-detail-copy]')!.textContent = item.copy;
    const detailNote=section.querySelector<HTMLElement>('[data-study-detail-note]')!;
    detailNote.textContent = item.note; detailNote.hidden = !item.note;
    const link = section.querySelector<HTMLAnchorElement>('[data-study-detail-link]')!;
    link.href = item.link; link.textContent = `${item.linkLabel} ↗`;
    const story = journeyNotes[id], storyLink = section.querySelector<HTMLAnchorElement>('[data-study-journey-link]')!;
    storyLink.hidden = !story;
    if (story) { storyLink.href = `/documentation/#journey-${story.slug}`; storyLink.textContent = `Read the build story: ${story.title} ↗`; }
    detail.hidden = false;
    screenPreview.hidden=id!=='monitor'||!screenOn;
    if(id==='monitor'&&!screenOn)setScreen(true);
    section.querySelectorAll<HTMLElement>('[data-study-select], [data-study-hotspot]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.studySelect || button.dataset.studyHotspot) === id)));
    focusComponent(id);
    setFocus([id]);
    const terminalTable=section.querySelector<HTMLElement>('[data-study-terminals]')!;
    terminalTable.hidden=id!=='mosfets'&&id!=='mosfet-led';
    if(!terminalTable.hidden) {
      const device=id==='mosfets'?'Fan':'LED';const supply=id==='mosfets'?'12 V':'24 V';
      section.querySelector('[data-study-load-label]')!.textContent=device;
      section.querySelector('[data-study-supply-label]')!.textContent=supply;
    }
    syncAction();
    status.textContent = `${item.label} selected. ${item.title}`;
    if (fromList) viewport.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  }
  const layerCount=section.querySelector<HTMLElement>('[data-study-layer-count]');
  function syncLayerCount(){if(layerCount)layerCount.textContent=`${section.querySelectorAll('#ms-layers-panel [aria-pressed="true"]').length} on`;}
  function setLayer(layer: 'cover' | 'wiring' | 'mushrooms' | 'labels') {
    finishAssembly();
    const current = layer === 'cover' ? coverOn : layer === 'wiring' ? wiringOn : layer === 'mushrooms' ? mushroomsVisible : labelsVisible;
    const visible = !current;
    if (layer === 'cover') coverOn = visible;
    if (layer === 'wiring') wiringOn = visible;
    if (layer === 'mushrooms') mushroomsVisible = visible;
    if (layer === 'labels') labelsVisible = visible;
    else animateLayer(layer, visible);
    section.dataset[`study${layer[0].toUpperCase()}${layer.slice(1)}`] = String(visible);
    section.querySelector(`button[data-study-${layer}]`)?.setAttribute('aria-pressed', String(visible));
    syncLayerCount();
    renderer.shadowMap.needsUpdate = true;
    syncAction(); draw();
    status.textContent = layer === 'mushrooms' ? (visible ? 'Illustrated oyster mushrooms shown.' : 'Illustrated oyster mushrooms hidden. The substrate bag remains.') : `${layer[0].toUpperCase()}${layer.slice(1)} ${visible ? 'shown' : 'hidden'}.`;
  }
  function runAction() {
    const action = componentById[selected].action;
    if (action === 'mushrooms' || action === 'cover' || action === 'wiring') { setLayer(action); viewport.scrollIntoView({block:'center',behavior:reduceMotion.matches?'instant':'smooth'}); return; }
    if(action==='screen'){setScreen(!screenOn);status.textContent=screenOn?'Screen on.':'Screen off.';return;}
    if(action==='light')sounds.switch('light');
    if(demos.has(action)){stopDemo(action);draw();wake();status.textContent='Component switched off. Other active components remain on.';return;}
    if(!demos.size)demoStarted=performance.now();demos.add(action);
    if(action==='fan'||action==='cooling'||action==='mist')sounds.loop(action);
    if (action === 'cooling') {cooler.airflow.visible=true;focusComponent(selected);}
    if (action === 'fan') {
      if (fanAirflow) fanAirflow.visible = true;
      focusComponent(selected);
    }
    if (action === 'mist') {
      devices.mist.visible = true;
      moveTo(V(1.12,2.10,-.10),viewport.clientWidth<700?1.7:1.35,V(6.0,5.4,9.2));
    }
    if (action === 'camera') { (selected==='camera2'?devices.cameraField2:devices.cameraField).visible=true; }
    if (action === 'light') {
      if (lightBeam) lightBeam.visible = true;
      ambient.intensity=.07;key.intensity=.13;fill.intensity=.025;scene.environmentIntensity=.025;
      illustrativeLight.intensity=17;tentFill.intensity=1.20;litFloor.visible=true;
      renderer.setClearColor('#17242a',1);section.dataset.studyLighting='tent';ledGlow.visible=true;
      // Frame the lit tent, leaving room for the explanation card on wider screens.
      const tentCentre=V(.55,2.12,-.12),tentView=tentCentre.clone();
      if(viewport.clientWidth>700)tentView.addScaledVector(V(1,0,0).applyQuaternion(camera.quaternion),.5);
      moveTo(tentView,viewport.clientWidth<700?1.75:1.3,V(6.1,6.2,9.1).add(tentView).sub(tentCentre));
      setFocus(null);
      devices.lightEmitters.forEach(mesh => { (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8; });
    }
    syncDemos();
    syncAction(); draw(); wake();
    viewport.scrollIntoView({block:'center',behavior:reduceMotion.matches?'instant':'smooth'});
    status.textContent = `${action === 'cooling' ? 'Cool airflow' : action === 'fan' ? 'Airflow' : action === 'mist' ? 'Mist path' : action === 'camera' ? 'Camera viewing area' : 'LED lighting'} demonstration shown.${reduceMotion.matches ? ' Motion is reduced.' : ''}`;
  }
  /** Fits the camera to a set of objects, keeping the current viewing direction. */
  function frame(objects: THREE.Object3D[], padding = 1.3) {
    const box=new THREE.Box3();objects.forEach(object=>box.expandByObject(object));
    if(box.isEmpty())return;
    camera.updateMatrixWorld();
    const corners=[0,1,2,3,4,5,6,7].map(i=>V(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(camera.matrixWorldInverse));
    const spanX=Math.max(...corners.map(c=>c.x))-Math.min(...corners.map(c=>c.x));
    const spanY=Math.max(...corners.map(c=>c.y))-Math.min(...corners.map(c=>c.y));
    const fit=Math.min((camera.right-camera.left)/(spanX*padding),(camera.top-camera.bottom)/(spanY*padding));
    // A group view never zooms out past the whole-setup overview.
    moveTo(box.getCenter(V(0,0,0)),THREE.MathUtils.clamp(fit,1,4.5));
  }
  function openGroup(category: Category) {
    if (tour) endTour(false);
    finishAssembly(); stopRotation(); detail.hidden = true;
    markers={mode:'some',show:new Set([category])};setRegionState('group');
    const ids=components.filter(item=>item.category===category).map(item=>item.id);
    const members=ids.map(id=>groups[id]);
    frame(members);setFocus(ids);
    status.textContent=`${category}: ${members.length} parts. Select a number to explore.`;
  }
  function zoom(direction: string) {
    tween = null;
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (direction === 'in' ? 1.18 : 1 / 1.18), 0.85, 8);
    camera.updateProjectionMatrix(); draw(); status.textContent = `View zoom ${Math.round(camera.zoom * 100)} percent.`;
  }
  function replayBuild(scroll = true) {
    if (tour) endTour(false);
    settleLayers();
    stopDemo();
    regionView('overview', scroll);
    if (reduceMotion.matches) { section.dataset.studyBuild = 'idle'; draw(); status.textContent = 'The assembled habitat is shown. Motion is reduced.'; return; }
    assembly = { start: performance.now(), saved: buildOrder.map(object => ({ object, position: object.position.clone(), visible: object.visible })) };
    assembly.saved.forEach(saved => saved.object.visible = false);
    section.dataset.studyBuild = 'running';
    section.querySelector('[data-study-build]')?.setAttribute('aria-pressed', 'true');
    status.textContent = 'Assembling the illustrated habitat.';
    if (scroll) viewport.scrollIntoView({ block: 'center', behavior: 'smooth' });
    wake(buildOrder.length*80+750);
  }

  section.querySelectorAll<HTMLElement>('[data-study-select]').forEach(button => button.addEventListener('click', () => select(button.dataset.studySelect as Component, true), eventOptions));
  section.querySelectorAll<HTMLElement>('button[data-study-region]').forEach(button => button.addEventListener('click', () => regionView(button.dataset.studyRegion as Region), eventOptions));
  section.querySelector('[data-study-reset]')?.addEventListener('click', () => regionView('overview'), eventOptions);
  section.querySelector('[data-study-close]')?.addEventListener('click', () => { detail.hidden = true; setFocus(null); draw(); status.textContent = 'Component explanation closed.'; }, eventOptions);
  actionButton.addEventListener('click', runAction, eventOptions);
  section.querySelector('[data-study-sound]')?.addEventListener('click',event=>{
    soundEnabled=!soundEnabled;sounds.setEnabled(soundEnabled);
    (event.currentTarget as HTMLElement).setAttribute('aria-pressed',String(soundEnabled));
    section.dataset.studySound=String(soundEnabled);status.textContent=soundEnabled?'Sound effects on.':'Sound effects muted.';
  },eventOptions);
  section.querySelector('[data-study-build]')?.addEventListener('click', () => replayBuild(), eventOptions);
  const tourCard = section.querySelector<HTMLElement>('[data-study-tour-card]')!;
  section.querySelectorAll<HTMLButtonElement>('[data-study-tour]').forEach(button => button.addEventListener('click', () => startTour(button.dataset.studyTour as TourRoute), eventOptions));
  tourCard.querySelector('[data-study-tour-next]')!.addEventListener('click', nextStep, eventOptions);
  tourCard.querySelector('[data-study-tour-prev]')!.addEventListener('click', () => { if (tour) showStep(tour.index - 1); }, eventOptions);
  tourCard.querySelector('[data-study-tour-play]')!.addEventListener('click', () => { if (tour) { tour.playing = !tour.playing; scheduleStep(); } }, eventOptions);
  tourCard.querySelector('[data-study-tour-exit]')!.addEventListener('click', () => endTour(true), eventOptions);
  const growthPanel = section.querySelector<HTMLElement>('[data-study-growth-panel]')!;
  const growthRange = growthPanel.querySelector<HTMLInputElement>('[data-study-growth-range]')!;
  section.querySelector('[data-study-growth]')?.addEventListener('click', openGrowth, eventOptions);
  growthRange.addEventListener('input', () => applyGrowth(Number(growthRange.value)), eventOptions);
  growthRange.addEventListener('change', () => { status.textContent = `${growthRange.getAttribute('aria-valuetext')} illustrated.`; }, eventOptions);
  growthPanel.querySelectorAll<HTMLButtonElement>('[data-study-growth-mark]').forEach((mark, index) => mark.addEventListener('click', () => { growthRange.value = String(index); applyGrowth(index); }, eventOptions));
  growthPanel.querySelector('[data-study-growth-close]')!.addEventListener('click', closeGrowth, eventOptions);
  growthPanel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeGrowth(); canvas.focus({ preventScroll: true }); } }, eventOptions);
  tourCard.addEventListener('keydown', event => {
    if (!tour) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); nextStep(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showStep(tour.index - 1); }
    if (event.key === 'Escape') { event.preventDefault(); endTour(true); canvas.focus({ preventScroll: true }); }
  }, eventOptions);
  for (const layer of ['cover', 'wiring', 'mushrooms', 'labels'] as const) section.querySelector(`button[data-study-${layer}]`)?.addEventListener('click', () => setLayer(layer), eventOptions);
  section.querySelector('button[data-study-sketch]')?.addEventListener('click', () => setSketch(!sketch), eventOptions);
  section.querySelector('button[data-study-every]')?.addEventListener('click', event => {
    everyPart=!everyPart;(event.currentTarget as HTMLElement).setAttribute('aria-pressed',String(everyPart));
    section.dataset.studyEvery=String(everyPart);syncLayerCount();draw();
    status.textContent=everyPart?'Every part is numbered.':'Parts are grouped. Select a group to number its parts.';
  }, eventOptions);
  section.querySelector('[data-study-rotate]')?.addEventListener('click', event => {
    finishAssembly(); tween = null; controls.autoRotate = !controls.autoRotate;
    (event.currentTarget as HTMLElement).setAttribute('aria-pressed', String(controls.autoRotate));
    status.textContent = controls.autoRotate ? 'Slow rotation started. Select Rotate again to pause.' : 'Rotation paused.'; wake();
  }, eventOptions);
  section.querySelectorAll<HTMLElement>('[data-study-zoom]').forEach(button => button.addEventListener('click', () => zoom(button.dataset.studyZoom!), eventOptions));
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape'].includes(event.key)) return;
    event.preventDefault(); finishAssembly(); tween = null; stopRotation();
    if (event.key === 'Home') regionView('overview');
    else if (event.key === 'Escape') { detail.hidden = true; status.textContent = 'Rotation paused. Explanation closed.'; }
    else if (['+','=','-'].includes(event.key)) zoom(event.key === '-' ? 'out' : 'in');
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') controls.rotateLeft(event.key === 'ArrowLeft' ? 0.12 : -0.12);
    else controls.rotateUp(event.key === 'ArrowUp' ? 0.09 : -0.09);
    // Apply the turn at once, so a key press never waits on the next animation frame.
    controls.update(); draw(); wake();
  }, eventOptions);
  // Layers and Play open as small disclosure panels above the toolbar.
  const menus=[...section.querySelectorAll<HTMLElement>('[data-study-menu]')];
  const closeMenus=(keep?:HTMLElement)=>menus.forEach(menu=>{
    if(menu===keep)return;
    menu.querySelector('[data-study-menu-toggle]')!.setAttribute('aria-expanded','false');menu.querySelector<HTMLElement>('.ms-menu-panel')!.hidden=true;
  });
  for(const menu of menus){
    const toggle=menu.querySelector<HTMLButtonElement>('[data-study-menu-toggle]')!,panel=menu.querySelector<HTMLElement>('.ms-menu-panel')!;
    toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';closeMenus(menu);toggle.setAttribute('aria-expanded',String(open));panel.hidden=!open;},eventOptions);
    menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.stopPropagation();closeMenus();toggle.focus();}},eventOptions);
    menu.addEventListener('focusout',event=>{if(!menu.contains(event.relatedTarget as Node))closeMenus();},eventOptions);
  }
  document.addEventListener('pointerdown',event=>{if(!menus.some(menu=>menu.contains(event.target as Node)))closeMenus();},eventOptions);
  section.querySelectorAll('.ms-play-item').forEach(item=>item.addEventListener('click',()=>closeMenus(),eventOptions));
  const raycaster = new THREE.Raycaster();raycaster.layers.enable(1);
  let down = new THREE.Vector2();
  const pickables = [...Object.entries(groups).filter(([id]) => id !== 'cover').map(([, group]) => group),wiring];
  const pickAt=(clientX:number,clientY:number)=>{
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((clientX-bounds.left)/bounds.width*2-1, -(clientY-bounds.top)/bounds.height*2+1),camera);
    const hit = raycaster.intersectObjects(pickables,true).find(item => {
      let object: THREE.Object3D | null = item.object;
      while (object) { if (!object.visible || object.userData.ignorePicking) return false; object = object.parent; } return true;
    });
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object) { if (object.userData.component && componentById[object.userData.component as Component]) return object.userData.component as Component; object = object.parent; }
    return null;
  };
  let hoverFrame=0;
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || event.buttons || assembly || demos.has('light')) { setHover(null); return; }
    const {clientX,clientY}=event;
    cancelAnimationFrame(hoverFrame);
    hoverFrame=requestAnimationFrame(()=>{const bounds=viewport.getBoundingClientRect();setHover(pickAt(clientX,clientY),clientX-bounds.left,clientY-bounds.top);});
  }, eventOptions);
  canvas.addEventListener('pointerleave', () => { cancelAnimationFrame(hoverFrame); setHover(null); }, eventOptions);
  canvas.addEventListener('pointerdown', event => { down.set(event.clientX,event.clientY); finishAssembly(); tween = null; stopRotation(); setHover(null); wake(); }, eventOptions);
  canvas.addEventListener('pointerup', event => {
    if (down.distanceTo(new THREE.Vector2(event.clientX,event.clientY)) > 6) return;
    const id = pickAt(event.clientX, event.clientY);
    if (id) select(id);
  }, eventOptions);
  controls.addEventListener('start', () => wake());
  controls.addEventListener('change', () => wake(100));
  controls.addEventListener('end', () => wake());
  const resize = new ResizeObserver(() => {
    const {width,height} = viewport.getBoundingClientRect(); if (!width || !height) return;
    const span = Math.max(6.5, 9.0 / (width/height));
    camera.left = -span*width/height/2; camera.right = -camera.left; camera.top = span/2; camera.bottom = -span/2;
    camera.updateProjectionMatrix(); renderer.setSize(width,height,false); draw();
  });
  resize.observe(viewport);
  let introduced = false;
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    // The first time the habitat comes into view, it assembles itself once.
    if (inView && !introduced) { introduced = true; if (!reduceMotion.matches) replayBuild(false); }
    sounds.suspend(!inView||document.hidden);
    if (inView) wake(); else { cancelAnimationFrame(animationFrame); animationFrame=0; lastFrame=0; }
  });
  visibility.observe(viewport);
  document.addEventListener('visibilitychange', () => { sounds.suspend(!inView||document.hidden); if (!document.hidden) wake(); else { cancelAnimationFrame(animationFrame); animationFrame=0; lastFrame=0; } },eventOptions);
  reduceMotion.addEventListener('change', () => { controls.enableDamping = !reduceMotion.matches; if (reduceMotion.matches) { tween=null; finishAssembly(); stopRotation(); } wake(); },eventOptions);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); alive=false; stopRotation(); stopDemo(); finishAssembly(); cancelAnimationFrame(animationFrame);
    fallback.hidden=false; section.dataset.studyState='unavailable'; canvas.hidden=true; detail.hidden=true;
    hotspots.forEach(({button}) => button.hidden=true); leaderLayer.style.display="none"; studyButtons.forEach(button => button.disabled=true);
    status.textContent='The browser paused 3D rendering. The still view is shown; reload to try again.';
  },eventOptions);
  renderer.shadowMap.needsUpdate=true; draw(); detail.hidden=true;
  // The still poster fades into the live scene rather than switching.
  if (reduceMotion.matches) fallback.hidden=true;
  else { fallback.dataset.leaving=''; window.setTimeout(()=>{fallback.hidden=true;delete fallback.dataset.leaving;},480); }
  Object.assign(section.dataset,{studySketch:'false',studyTour:'none',studyFocus:'none',studyEvery:'false',studyState:'ready',studySelected:'bag',studyMushrooms:'true',studyCover:'false',studyWiring:'false',studyLabels:'true',studyDemo:'none',studyBuild:'idle',studyRegion:'overview',studyLighting:'day',studyScreen:'off',studySound:'true'});
  studyButtons.forEach(button => button.disabled=false); syncAction(); syncLayerCount();
  syncDemos();
  status.textContent='Interactive habitat ready. Select any component to explore.';
  const openFromHash = () => {
    const part = location.hash.match(/^#study-([\w-]+)$/)?.[1] as Component | undefined;
    if (part && componentById[part]) { introduced = true; finishAssembly(); select(part, true); }
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash, eventOptions);
  window.addEventListener('pageshow',()=>sounds.suspend(!inView||document.hidden),eventOptions);
  window.addEventListener('pagehide', event => {
    sounds.suspend(true);
    if (event.persisted) return;
    sounds.dispose();screenTexture?.dispose();
    alive=false; cancelAnimationFrame(animationFrame); cleanup.abort(); visibility.disconnect(); resize.disconnect(); controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
    scene.traverse(object => { if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return; geometries.add(object.geometry); (Array.isArray(object.material)?object.material:[object.material]).forEach(material => materials.add(material)); });
    materials.forEach(material => { Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); material.dispose(); });
    textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose()); environment.dispose(); renderer.dispose();
  });
}
