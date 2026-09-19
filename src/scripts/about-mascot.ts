import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Authored character and scenery only; no experiment data. */
export function mountMascot(root:HTMLElement){
  const host=root.querySelector<HTMLElement>('[data-mascot-stage]')!;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  host.append(renderer.domElement);const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Move the fluffy mascot with arrow keys or WASD. Space to hop. Click objects to explore.');
  const scene=new T.Scene();const camera=new T.PerspectiveCamera(36,1,.1,80);camera.position.set(0,7.6,12.8);camera.lookAt(0,.4,0);
  scene.add(new T.HemisphereLight(0xfff6e4,0xb0b4a0,2.3));
  const key=new T.DirectionalLight(0xffedcd,3.4);key.position.set(-4,8,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7});key.shadow.normalBias=.04;scene.add(key);
  const fill=new T.DirectionalLight(0xe4edff,1.2);fill.position.set(4,3,-3);scene.add(fill);
  const mat=(color:number,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
  const cream=mat(0xe6d0a8),ivory=mat(0xf5e7cc),olive=mat(0x798a69),dark=mat(0x263c35),orange=mat(0xb9704f),wood=mat(0xcfb88e);
  function mesh(geo:T.BufferGeometry,m:T.Material,parent:T.Object3D,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function ball(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const o=mesh(new T.SphereGeometry(1,28,20),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
  function box(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){return mesh(new T.BoxGeometry(w,h,d),m,parent,x,y,z);}
  mesh(new T.CylinderGeometry(4.45,4.55,.22,96),mat(0xd4cfbb),scene,0,-.16,0);
  const floor=mesh(new T.CircleGeometry(4.43,96),mat(0xe5dfcc),scene,0,-.04,0);floor.rotation.x=-Math.PI/2;
  const ring=mesh(new T.RingGeometry(4.1,4.12,100),mat(0xc4c1a8),scene,0,-.032,0);ring.rotation.x=-Math.PI/2;
  const destinations:Record<string,T.Vector3>={maker:new T.Vector3(0,0,1),mushrooms:new T.Vector3(-2.4,0,.2),software:new T.Vector3(1.9,0,-.6),building:new T.Vector3(-1.75,0,-1.5),learning:new T.Vector3(2.3,0,1.25),links:new T.Vector3(-2.2,0,1.65)};
  const interactables:T.Object3D[]=[];
  function prop(id:string,x:number,z:number){const group=new T.Group();group.position.set(x,0,z);group.userData.note=id;scene.add(group);interactables.push(group);return group;}
  function label(text:string,parent:T.Group,y:number){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#f6f3eb';ctx.roundRect(3,3,506,90,24);ctx.fill();ctx.fillStyle='#53634e';ctx.font='38px Georgia';ctx.textAlign='center';ctx.fillText(text,256,58);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,toneMapped:false}));sprite.position.y=y;sprite.scale.set(1.7,.32,1);parent.add(sprite);}
  const mushrooms=prop('mushrooms',-2.8,-.6);mesh(new T.CylinderGeometry(.75,.65,.16,48),wood,mushrooms,0,.06,0);
  for(const [x,z,s] of [[-.25,0,.8],[.3,.1,.58],[.1,-.3,1.05]]){mesh(new T.CylinderGeometry(.1*s,.16*s,.8*s,16),ivory,mushrooms,x,.48*s,z);const cap=mesh(new T.SphereGeometry(.48*s,32,20,0,Math.PI*2,0,Math.PI/2),orange,mushrooms,x,.88*s,z);cap.scale.y=.55;mesh(new T.CircleGeometry(.48*s,32),cream,mushrooms,x,.88*s,z).rotation.x=Math.PI/2;}
  label('02 / Mushrooms',mushrooms,1.5);
  const desk=prop('software',1.9,-2);box(desk,wood,0,1,0,2,.14,1);for(const x of [-.8,.8])for(const z of [-.35,.35])box(desk,olive,x,.46,z,.1,1,.1);
  box(desk,dark,0,1.11,0,1.1,.06,.65);const screen=box(desk,dark,0,1.5,-.24,1.1,.75,.055);screen.rotation.x=-.13;box(desk,mat(0xb7cab0),0,1.5,-.19,.98,.62,.02);
  for(let i=0;i<4;i++)box(desk,i===0?orange:olive,-.12,1.68-i*.105,-.17,.5-i*.065,.025,.015);label('03 / Code & vision',desk,2.15);
  const build=prop('building',-1.05,-2.6);box(build,wood,0,.13,0,1.3,.26,.8);for(const x of [-.42,.42]){mesh(new T.CylinderGeometry(.05,.05,1.05,12),ivory,build,x,.8,0);}const pipe=mesh(new T.CylinderGeometry(.05,.05,.84,12),ivory,build,0,1.3,0);pipe.rotation.z=Math.PI/2;box(build,orange,.1,.31,.12,.5,.1,.13);label('04 / The build',build,1.7);
  const book=prop('learning',2.95,1.15);book.rotation.y=-.25;box(book,olive,0,.13,0,1,.12,.8);box(book,ivory,0,.23,0,.95,.1,.75);box(book,olive,0,.3,0,1,.05,.8);box(book,wood,0,.334,0,.6,.012,.38);box(book,orange,.22,.32,.38,.12,.025,.2);label('05 / Field notes',book,.95);
  const mail=prop('links',-2.55,2);box(mail,ivory,0,.1,0,.95,.1,.6);mesh(new T.CylinderGeometry(.09,.09,.018,24),orange,mail,0,.164,0);label('06 / Find the work',mail,.72);
  // A soft, pear-shaped body with individually curved, gravity-draped strands.
  const character=new T.Group();character.position.copy(destinations.maker);scene.add(character);character.userData.note='maker';interactables.push(character);
  const body=new T.Group();character.add(body);
  ball(body,cream,0,.85,0,.72,.82,.58);
  let seed=37;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const strands:T.BufferGeometry[]=[];
  for(let i=0;i<2600;i++){
    const theta=rand()*Math.PI*2,v=rand()*1.91- .95;const r=Math.sqrt(1-v*v);const x=.73*r*Math.cos(theta),y=.86+.82*v,z=.6*r*Math.sin(theta);
    // Clear sockets so the eyes peek through the fringe, as in the reference.
    if(z>.32&&Math.abs(y-1.01)<.17&&Math.abs(Math.abs(x)-.27)<.2)continue;
    const length=.18+rand()*.24;const n=new T.Vector3(x,v*.45,z).normalize();const phase=rand()*6.28;
    const points=Array.from({length:5},(_,j)=>{const t=j/4;return new T.Vector3(x+n.x*t*.12+Math.sin(t*5+phase)*.026*t,y+n.y*.06*t-length*t*t,z+n.z*.13*t+Math.sin(t*4+phase)*.022*t);});
    strands.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),5,.006+rand()*.006,3,false));
  }
  const furGeo=mergeGeometries(strands);strands.forEach(g=>g.dispose());const fur=mesh(furGeo,ivory,body);fur.castShadow=false;fur.receiveShadow=false;
  const pupils:T.Mesh[]=[];const eyes:T.Group[]=[];
  for(const x of [-.27,.27]){const eye=new T.Group();eye.position.set(x,1.02,.53);body.add(eye);ball(eye,mat(0xcdbda0),0,0,0,.185,.18,.075);ball(eye,mat(0x60452b,.3),0,-.018,.048,.132,.139,.055);const pupil=ball(eye,mat(0x171712,.13),0,-.01,.098,.088,.101,.024);pupils.push(pupil);ball(eye,mat(0xffffff,.1),-.031,.034,.12,.027,.018,.012);eyes.push(eye);}
  const mouth=mesh(new T.TorusGeometry(.049,.01,6,18,Math.PI),dark,body,0,.77,.601);mouth.rotation.z=.08;
  const feet=[ball(character,cream,-.31,.09,.17,.19,.105,.25),ball(character,cream,.31,.09,.17,.19,.105,.25)];
  const marker=mesh(new T.RingGeometry(.12,.15,32),orange,scene,0,.005,0);marker.rotation.x=-Math.PI/2;marker.visible=false;
  let target=character.position.clone(),hop=0,elapsed=0,visible=true,dragStart={x:0,y:0};const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const status=root.querySelector<HTMLElement>('[data-mascot-status]')!;
  function move(p:T.Vector3){target.copy(p);target.y=0;if(target.length()>3.35)target.setLength(3.35);marker.position.set(target.x,.005,target.z);marker.visible=true;root.dataset.mascotMoving='true';}
  function choose(id:string,notify=true){move(destinations[id]??destinations.maker);if(id==='maker')hop=1;if(notify)root.dispatchEvent(new CustomEvent('mascot-note',{detail:id}));status.textContent=id==='maker'?'Hello, curious human.':'On my way…';}
  root.addEventListener('mascot-destination',e=>choose((e as CustomEvent<string>).detail,false));
  root.querySelector('[data-mascot-hop]')!.addEventListener('click',()=>{hop=1;status.textContent='A little hop for a big idea.';});root.querySelector('[data-mascot-home]')!.addEventListener('click',()=>choose('maker'));
  const ray=new T.Raycaster(),pointer=new T.Vector2();let look=new T.Vector2();
  function cast(e:PointerEvent){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);}
  canvas.addEventListener('pointermove',e=>{cast(e);look.copy(pointer);canvas.style.cursor=ray.intersectObjects(interactables,true).length?'pointer':'crosshair';});
  canvas.addEventListener('pointerdown',e=>{dragStart={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-dragStart.x,e.clientY-dragStart.y)>8)return;cast(e);const hit=ray.intersectObjects(interactables,true).find(h=>!(h.object instanceof T.Sprite));if(hit){let object:T.Object3D|null=hit.object;while(object&&!object.userData.note)object=object.parent;if(object){choose(object.userData.note);return;}}const point=ray.intersectObject(floor)[0]?.point;if(point){move(point);status.textContent='Exploring the little things.';}});
  canvas.addEventListener('keydown',e=>{const directions:Record<string,[number,number]>={ArrowLeft:[-.45,0],a:[-.45,0],ArrowRight:[.45,0],d:[.45,0],ArrowUp:[0,-.45],w:[0,-.45],ArrowDown:[0,.45],s:[0,.45]};if(e.code==='Space'){e.preventDefault();hop=1;}const d=directions[e.key];if(d){e.preventDefault();move(target.clone().add(new T.Vector3(d[0],0,d[1])));}});
  const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  root.dataset.character='ready';root.querySelector<HTMLElement>('[data-mascot-help]')!.hidden=false;new ResizeObserver(resize).observe(host);resize();
  new IntersectionObserver(entries=>visible=entries[0].isIntersecting).observe(host);
  let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.04);last=now;if(!visible||document.hidden)return;elapsed+=dt;const delta=target.clone().sub(character.position);delta.y=0;const walking=delta.length()>.025;
    if(walking){character.position.addScaledVector(delta.normalize(),Math.min(1.5*dt,target.distanceTo(character.position)));const angle=Math.atan2(delta.x,delta.z);character.rotation.y+=Math.atan2(Math.sin(angle-character.rotation.y),Math.cos(angle-character.rotation.y))*Math.min(1,dt*7);}else{marker.visible=false;root.dataset.mascotMoving='false';character.rotation.y+=Math.atan2(Math.sin(-character.rotation.y),Math.cos(-character.rotation.y))*dt*3;}
    hop=Math.max(0,hop-dt*1.65);const bounce=hop>0?Math.sin(hop*Math.PI)*.65:0;
    body.position.y=reduced.matches?0:bounce+(walking?Math.abs(Math.sin(elapsed*11))*.065:Math.sin(elapsed*2)*.015);body.rotation.z=reduced.matches?0:walking?Math.sin(elapsed*11)*.055:Math.sin(elapsed)*.012;
    feet.forEach((foot,i)=>{foot.position.y=.09+(reduced.matches?0:bounce+(walking?Math.max(0,Math.sin(elapsed*11+i*Math.PI))*.14:0));});
    const blink=!reduced.matches&&elapsed%4.7<.16;eyes.forEach(eye=>eye.scale.y=blink?.12:1);pupils.forEach(pupil=>{pupil.position.x=look.x*.018;pupil.position.y=-.01+look.y*.014;});
    root.dataset.mascotPosition=`${character.position.x.toFixed(2)},${character.position.z.toFixed(2)}`;renderer.render(scene,camera);
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);root.dataset.character='unavailable';root.querySelector<HTMLElement>('[data-mascot-help]')!.hidden=true;});
}
