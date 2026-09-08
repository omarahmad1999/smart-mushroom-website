import * as THREE from 'three';
import { tube, roundedBox } from './hardware';
import { mergeParts } from './geometry';
import { positions as p, add, terminalPoint, sensorColors, wireColors, cobblerPoint, cobblerRibbonPoint, stripPlug, type Point, type ItemId } from './layout';

export type IllustratedConnection = { name:string; owner:ItemId; points:Point[]; color:string; radius:number };
export function createWiring() {
  const root=new THREE.Group();root.name='User-specified hardware connections';
  const owners=new Map<ItemId,THREE.Group>();
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const connections:IllustratedConnection[]=[];
  const material=(color:string)=>{
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));
    return materials.get(color)!;
  };
  const owner=(id:ItemId)=>{
    if(!owners.has(id)) {const g=new THREE.Group();g.name=`${id} connections`;g.userData.component=id;owners.set(id,g);root.add(g);}
    return owners.get(id)!;
  };
  const cable=(name:string,id:ItemId,points:Point[],color=wireColors.black,radius=.009)=>{
    connections.push({name,owner:id,points,color,radius});
    owner(id).add(tube(points,radius,material(color),Math.max(18,points.length*6)));
  };
  const plug=(id:ItemId,position:Point,size:Point)=>{
    const m=roundedBox(...size,.004,material('#343f39'));m.position.set(...position);owner(id).add(m);
  };
  const ribbon=(name:string,id:ItemId,points:Point[],width:number,color:string)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));
    const vertices:number[]=[],indices:number[]=[],edge:Point[]=[];
    for(let i=0;i<=64;i++) {
      const t=i/64,centre=curve.getPoint(t), tangent=curve.getTangent(t);
      let side=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,1,0));
      if(side.lengthSq()<.01)side.set(1,0,0);side.normalize().multiplyScalar(width/2);
      const a=centre.clone().add(side),b=centre.clone().sub(side);
      vertices.push(...a.toArray(),...b.toArray());edge.push(a.toArray() as Point);
      if(i<64) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mat=material(color).clone();mat.side=THREE.DoubleSide;
    const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;owner(id).add(mesh);
    cable(name,id,points,color,.001);
    owner(id).add(tube(edge,.0018,material(id==='cobbler'?'#bc6b58':'#d4a56b'),64));
  };

  // Each black sensor jacket fans into four conductors; matching colours share a Wago.
  const splits:Record<'sensor'|'sht',Point>={sensor:[-.86,1.37,-.62],sht:[-.87,1.43,-.72]};
  for(const [index,id] of (['sensor','sht'] as const).entries()) {
    const start=add(p[id],id==='sensor'?[0,.116,-.008]:[0,-.13,0]);
    const z=-.73-index*.037;
    cable(`${id}-jacket`,id,[start,[-.30,start[1],z],[-.38,1.67,z],[-.49,1.42,z],splits[id]],wireColors.black,.012);
    for(const [i,color] of sensorColors.entries()) {
      const wago=p[`wago-${color}`];
      const end=add(wago,[index===0?-.047:.047,0,-.058]);
      cable(`${id}-${color}-to-wago`,id,[splits[id],[-1.00-i*.035,1.37+index*.020,-.65-index*.035],
        [end[0],1.365,-.665-index*.022],end],wireColors[color],.004);
    }
  }
  for(const color of sensorColors) {
    const start=add(p[`wago-${color}`],[0,0,.058]);
    const end=cobblerPoint(color);
    cable(`wago-${color}-to-cobbler`,`wago-${color}`,[start,[start[0],1.385,-.33],[end[0],1.386,-.26],end],wireColors[color],.004);
  }

  // Device leads use the LEFT pair. Each cable jacket splits near its own module.
  const fanSplit:Point=[-2.18,1.38,.29],ledSplit:Point=[-1.41,1.38,.28];
  cable('fan-jacket','fan',[[1.45,.77,-.23],[1.46,.84,-.50],[1.32,.93,-.72],[-.22,.95,-.76],[-.45,1.14,-.72],[-.70,1.32,-.64],[-2.12,1.32,-.56],fanSplit],wireColors.black,.011);
  cable('led-jacket','light',[[-.285,4.087,-.679],[-.34,4.0,-.70],[-.36,3.8,.37],[-.36,3.23,.40],[-.37,1.91,.40],[-.45,1.45,.37],[-.82,1.32,.20],ledSplit],wireColors.black,.010);
  for(const [id,split,device] of [['mosfets',fanSplit,'fan'],['mosfet-led',ledSplit,'light']] as const) {
    for(const color of ['black','red'] as const) {
      const end=terminalPoint(id,`load-${color}`);
      cable(`${device}-${color}-to-left`,id,[split,[end[0]-.08,1.40,end[2]-.035],end],wireColors[color],.0048);
    }
    for(const color of ['red','black'] as const) {
      const start=terminalPoint(id,`breadboard-${color}`);
      const end=cobblerPoint(`${id==='mosfets'?'fan':'led'}-${color}`);
      const side=id==='mosfets'?-.16:.16;
      cable(`${id}-bottom-${color}-to-cobbler`,id,[start,[start[0]+side,1.38,.69],[start[0]+side,1.40,.19],[end[0],1.40,.17],end],wireColors[color],.004);
    }
  }

  // Floor strip is supplied by the UPS. The adapter outputs use the RIGHT pair.
  cable('ups-to-floor-strip','power-strip',[add(stripPlug,[0,0,-.075]),[-2.95,.26,-.40],[-2.60,.16,-.37],[-2.40,.16,.45],[-1.94,.16,.87],[-1.735,.19,1.06]],wireColors.black,.014);
  for(const [adapter,module,split] of [
    ['adapter12','mosfets',[-1.70,1.37,.27]],['adapter24','mosfet-led',[-.93,1.37,.27]],
  ] as const) {
    const origin=add(p[adapter],[0,-.01,.121]);
    const outer=adapter==='adapter12'?-.81:-.73;
    cable(`${adapter}-jacket`,adapter,[origin,[origin[0],.28,1.28],[outer,.22,1.22],[outer,.50,.79],[outer,1.24,.77],[outer,1.34,.52],split as Point],wireColors.black,.009);
    for(const color of ['black','red'] as const) {
      const end=terminalPoint(module,`supply-${color}`);
      cable(`${adapter}-${color}-to-right`,adapter,[split as Point,[end[0]+.095,1.40,end[2]-.034],end],wireColors[color],.0048);
    }
  }

  // Official USB-C supply plugs into the UPS and powers the Pi's USB-C socket.
  const usbC=add(p.pi,[-.145,.019,.169]);
  cable('official-supply-usbc-to-pi','pi-power',[add(p['pi-power'],[0,.10,0]),[-2.90,1.10,-.46],[-2.75,1.32,-.63],[-2.56,1.34,-.48],[-2.55,1.35,.00],[usbC[0],usbC[1],usbC[2]+.036],usbC],wireColors.black,.009);
  plug('pi-power',add(usbC,[0,0,.020]),[.044,.020,.040]);
  // Visible USB-A shell at the Pi, with a separate SSD-side connector.
  const usbA=add(p.pi,[.232,.058,-.106]);
  cable('ugreen-ssd-usba-to-pi','ssd',[add(p.ssd,[0,0,-.165]),[-2.40,1.345,.22],[-2.13,1.35,.18],[-1.965,1.36,.04],[usbA[0]+.09,usbA[1],usbA[2]],usbA],wireColors.black,.007);
  plug('ssd',add(usbA,[.039,0,0]),[.077,.021,.046]);
  plug('ssd',add(p.ssd,[0,0,-.181]),[.045,.022,.039]);

  // GPIO ribbon and two separate camera ribbons. Neither camera lives on the table.
  ribbon('pi-gpio-to-t-cobbler','cobbler',[add(p.pi,[-.023,.057,-.128]),[-2.323,1.52,-.45],[-2.04,1.59,-.24],[-1.85,1.52,-.05],cobblerRibbonPoint()],.135,'#a7aaa1');
  for(const [i,id] of (['camera','camera2'] as const).entries()) {
    const start=add(p[id],[-.018,.059,-.001]);
    const z=-.38-i*.046;
    ribbon(`${id}-to-pi`,id,[start,[-.38,p[id][1]-.04,z],[-.43,1.65,z],[-.66,1.37,z],[-1.05,1.32,-.68-i*.03],[-2.50,1.335,-.67-i*.03],add(p.pi,[-.19,.017,.04-i*.08])],.036,'#b6a17c');
  }
  // HDMI at the monitor, micro-HDMI at the Pi. Keyboard and mouse are wireless.
  const microHdmi=add(p.pi,[-.062,.019,.169]);
  const monitorHdmi=add(p.monitor,[0,.44,-.045]);
  cable('monitor-micro-hdmi-to-pi','monitor',[monitorHdmi,[-3.42,1.37,-.55],[-3.10,1.335,-.57],[-2.66,1.35,-.57],[-2.62,1.36,.13],[-2.42,1.36,.21],add(microHdmi,[0,0,.050]),microHdmi],wireColors.black,.007);
  plug('monitor',add(microHdmi,[0,0,.025]),[.032,.016,.050]);
  plug('monitor',add(monitorHdmi,[0,0,-.018]),[.072,.029,.052]);
  for(const g of owners.values())mergeParts(g);
  root.userData.connections=connections;
  return root;
}
