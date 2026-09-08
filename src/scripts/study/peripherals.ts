import * as THREE from 'three';
import { roundedBox, rod, inscription } from './hardware';
import { positions, type ItemId, type Point, sensorColors, stripPlug } from './layout';
import { mergeParts } from './geometry';

export function createPeripherals() {
  const mat = (color: string, roughness=.65, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  const ivory=mat('#e5e2d5'), dark=mat('#323c38'), inset=mat('#172522'), silver=mat('#acb4ab',.4,.5);
  const pcb=mat('#608773'), orange=mat('#c48256'), gold=mat('#bc9e68',.5,.3), pink=mat('#b79595');
  const result: Partial<Record<ItemId,THREE.Group>>={};
  const group = (id:ItemId,name:string) => {
    const root=new THREE.Group();root.name=name;root.userData.component=id;root.position.set(...positions[id]);result[id]=root;return root;
  };
  const box=(g:THREE.Group,size:Point,p:Point,m:THREE.Material,r=.006) => {
    const mesh=roundedBox(...size,r,m);mesh.position.set(...p);g.add(mesh);return mesh;
  };
  const label=(g:THREE.Group,text:string,p:Point,w:number,h:number,color='#73806e') => {
    const mesh=inscription(text,color,w,h);mesh.rotation.x=-Math.PI/2;mesh.position.set(...p);g.add(mesh);
  };
  const monitor=group('monitor','Workbench monitor');
  box(monitor,[.39,.035,.26],[0,.018,.04],dark,.015);
  box(monitor,[.067,.30,.06],[0,.18,-.008],dark,.007);
  box(monitor,[1.16,.78,.066],[0,.63,0],dark,.025);
  const screenMaterial=new THREE.MeshBasicMaterial({color:'#14221f',toneMapped:false});
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.075,.681),screenMaterial);
  screen.position.set(0,.65,.0355);monitor.add(screen);
  monitor.userData.screenMaterial=screenMaterial;
  box(monitor,[.045,.008,.003],[0,.276,.036],silver,.002);
  // The display uses a single static mock-up image when switched on.
  const keyboard=group('keyboard','Compact keyboard');
  box(keyboard,[.94,.032,.33],[0,0,0],dark,.015);
  for(let row=0;row<5;row++) for(let col=0;col<14;col++) {
    if(row===4&&col>3&&col<10)continue;
    const x=-.431+col*.066,z=-.128+row*.063;
    box(keyboard,[.052,.018,.050],[x,.023,z],row===0&&col===0?orange:(col>11?dark:ivory),.004);
  }
  box(keyboard,[.384,.018,.050],[-.004,.023,.124],ivory,.004);
  const mouse=group('mouse','Mouse');
  const mouseShell=new THREE.Mesh(new THREE.SphereGeometry(1,24,14),pink);
  mouseShell.scale.set(.077,.044,.115);mouseShell.position.y=.025;mouse.add(mouseShell);
  box(mouse,[.14,.014,.20],[0,-.006,0],dark,.015);
  box(mouse,[.003,.003,.072],[0,.068,-.046],dark,.001);
  box(mouse,[.014,.011,.032],[0,.066,-.022],silver,.004);

  const breadboard=group('breadboard','Solderless breadboard');
  box(breadboard,[.68,.055,.38],[0,0,0],ivory,.013);
  box(breadboard,[.60,.004,.025],[0,.029,0],inset,.001);
  const holes:THREE.BufferGeometry[]=[];
  for(let col=0;col<30;col++) for(const z of [-.148,-.126,-.091,-.075,-.059,-.043,-.027,.027,.043,.059,.075,.091,.126,.148]) {
    const hole=new THREE.CircleGeometry(.0034,7);hole.rotateX(-Math.PI/2);hole.translate(-.29+col*.020,.029,z);holes.push(hole);
  }
  // Keep the perforations as geometry so close-ups remain crisp.
  for(const geometry of holes)breadboard.add(new THREE.Mesh(geometry,inset));
  for(const [z,color] of [[-.163,'#bd6256'],[-.112,'#668594'],[.112,'#bd6256'],[.163,'#668594']] as const) {
    box(breadboard,[.60,.001,.002],[0,.030,z],mat(color),.0004);
  }
  label(breadboard,'a  b  c  d  e     f  g  h  i  j',[0,.031,.105],.51,.018);
  const cobbler=group('cobbler','T-cobbler GPIO breakout and ribbon cable');
  // The long axis follows the breadboard's horizontal centre trench.
  box(cobbler,[.46,.014,.115],[0,0,0],pcb,.003);
  box(cobbler,[.091,.014,.230],[-.19,0,0],pcb,.004);
  box(cobbler,[.067,.048,.180],[-.19,.027,0],dark,.004);
  box(cobbler,[.036,.004,.144],[-.19,.053,0],inset,.003);
  for(const z of [-.05,.05])for(let i=0;i<18;i++) {
    const x=-.14+i*.018;
    cobbler.add(rod(new THREE.Vector3(x,-.046,z),new THREE.Vector3(x,.013,z),.002,gold,6));
    box(cobbler,[.015,.020,.019],[x,.020,z],dark,.002);
    box(cobbler,[.006,.002,.007],[x,.031,z],gold,.001);
  }
  label(cobbler,'GPIO',[.035,.009,0],.12,.031,'#e6ebda');

  for(const color of sensorColors) {
    const wago=group(`wago-${color}`,`${color} sensor wire Wago connector`);
    box(wago,[.15,.064,.112],[0,0,0],mat('#bbc0b4'),.008);
    for(const x of [-.047,0,.047]) {
      box(wago,[.037,.019,.071],[x,.039,-.005],orange,.003);
      box(wago,[.014,.024,.004],[x,-.001,-.058],inset,.002);
    }
    box(wago,[.018,.024,.004],[0,-.001,.058],inset,.002);
  }
  const strip=group('power-strip','UPS-fed floor power strip');
  box(strip,[.97,.095,.28],[0,0,0],ivory,.026);
  for(const x of [-.22,.25]) {
    box(strip,[.29,.005,.22],[x,.05,0],mat('#d3d6c9'),.018);
    for(const dx of [-.040,.040]) box(strip,[.014,.003,.030],[x+dx,.054,0],inset,.004);
  }
  box(strip,[.045,.009,.082],[-.415,.052,0],orange,.005);
  // The floor strip owns its AC plug as well as the lead back to the UPS.
  const head=stripPlug.map((v,i)=>v-positions['power-strip'][i]) as Point;
  box(strip,[.16,.16,.09],head,ivory,.018);
  for(const x of [-.031,.031])box(strip,[.011,.022,.051],[head[0]+x,head[1],head[2]+.064],silver,.002);
  box(strip,[.035,.035,.035],[head[0],head[1],head[2]-.056],dark,.005);
  for(const [id,text] of [['adapter12','12 V'],['adapter24','24 V']] as const) {
    const adapter=group(id,`${text} power adapter`);
    box(adapter,[.235,.16,.205],[0,0,0],dark,.019);
    for(const x of [-.038,.038])box(adapter,[.012,.029,.018],[x,-.091,0],silver,.002);
    label(adapter,text,[0,.082,0],.18,.09,'#d3d8c8');
    box(adapter,[.03,.018,.024],[0,-.01,.11],dark,.005);
  }
  const charger=group('pi-power','Official Raspberry Pi USB-C power supply');
  box(charger,[.19,.19,.09],[0,0,0],ivory,.02);
  for(const x of [-.031,.031])box(charger,[.011,.022,.051],[x,0,.064],silver,.002);
  box(charger,[.043,.007,.021],[0,.099,0],dark,.004);
  label(charger,'USB-C',[0,.101,-.019],.14,.035);
  for(const g of Object.values(result))mergeParts(g);
  return result as Record<'monitor'|'keyboard'|'mouse'|'breadboard'|'cobbler'|'wago-red'|'wago-black'|'wago-yellow'|'wago-green'|'power-strip'|'adapter12'|'adapter24'|'pi-power',THREE.Group>;
}
