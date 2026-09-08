import * as THREE from 'three';
import { mergeParts } from './geometry';
import { positions, terminalOffsets } from './layout';
import { roundedBox, rod, inscription } from './hardware';

/** A deliberately arranged hardware cutaway, with authored geometry only. */
export function createWorkbench() {
  const standard = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const material = {
    wood: standard('#c3b28d', 0.83),
    tabletop: standard('#e5e0ce', 0.76),
    sage: standard('#798b78', 0.63),
    charcoal: standard('#35403b', 0.58),
    recess: standard('#1d2824', 0.85),
    pcb: standard('#547d61', 0.7),
    terminal: standard('#719065', 0.6),
    metal: standard('#b4b9ac', 0.35, 0.65),
    gold: standard('#b5a276', 0.43, 0.5),
    usb: standard('#547784', 0.64),
    pale: standard('#e0e2d4', 0.69),
    alloy: standard('#67726b', 0.48, 0.55),
    copper: standard('#b57a5b', 0.7),
    cable: standard('#667260', 0.86),
  };
  const furniture = new THREE.Group();
  furniture.name = 'Expanded ivory and sage workbench';
  furniture.userData.component = 'table';
  const device = (id: string, name: string, position: [number, number, number]) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.component = id;
    group.position.set(...position);
    return group;
  };
  const pi = device('pi', 'Raspberry Pi 5, shown with exposed PCB and cooler', positions.pi);
  const ai = device('ai', 'Raspberry Pi AI HAT 2, elevated cutaway', positions.ai);
  const mosfets = device('mosfets', 'Fan MOSFET', positions.mosfets);
  const mosfetLed = device('mosfet-led', 'LED MOSFET', positions['mosfet-led']);
  const ups = device('ups', 'APC Schneider UPS', positions.ups);
  const ssd = device('ssd', 'UGREEN SSD enclosure', positions.ssd);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const box = (group: THREE.Group, size: [number, number, number], position: [number, number, number], mat: THREE.Material, radius = 0.004) => {
    const mesh = roundedBox(...size, radius, mat);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  const pin = (group: THREE.Group, x: number, y: number, z: number, radius = 0.006, height = 0.016, mat: THREE.Material = material.metal) => {
    const mesh = rod(V(x, y - height / 2, z), V(x, y + height / 2, z), radius, mat, 12);
    group.add(mesh);
    return mesh;
  };
  const topLabel = (group: THREE.Group, text: string, width: number, height: number, position: [number, number, number], color = '#e0e6d8') => {
    const label = inscription(text, color, width, height);
    label.rotation.x = -Math.PI / 2;
    label.position.set(...position);
    group.add(label);
  };

  box(furniture,[3.30,.07,1.40],positions.table,material.tabletop,.027);
  box(furniture,[3.28,.018,1.38],[-2.41,1.231,.02],material.wood,.018);
  for(const x of [-3.95,-.87]) for(const z of [-.57,.61]) {
    box(furniture,[.075,1.08,.075],[x,.699,z],material.sage,.009);
    box(furniture,[.080,.028,.080],[x,.154,z],material.charcoal,.008);
  }
  for(const x of [-3.95,-.87]) box(furniture,[.046,.046,1.18],[x,.35,.02],material.sage,.006);
  for(const z of [-.57,.61]) box(furniture,[3.12,.070,.042],[-2.41,1.18,z],material.sage,.006);
  box(furniture,[3.12,.044,.043],[-2.41,.35,-.57],material.sage,.005);

  // Exposed Pi board: an honest illustrative cutaway of the enclosed computer.
  box(pi, [0.45, 0.018, 0.31], [0, 0, 0], material.pcb, 0.013);
  for (const x of [-0.194, 0.194]) {
    for (const z of [-0.124, 0.124]) {
      pin(pi, x, -0.022, z, 0.012, 0.026, material.gold);
      pin(pi, x, 0.011, z, 0.009, 0.004);
    }
  }
  // Paired USB stacks and an Ethernet shell along the short edge.
  for (const z of [-0.106, -0.010]) {
    box(pi, [0.091, 0.072, 0.081], [0.181, 0.044, z], material.metal, 0.003);
    for (const y of [0.026, 0.058]) {
      box(pi, [0.002, 0.023, 0.065], [0.227, y, z], material.recess, 0.001);
      box(pi, [0.003, 0.005, 0.054], [0.229, y + 0.001, z], z < -0.05 ? material.usb : material.pale, 0.001);
    }
  }
  box(pi, [0.096, 0.085, 0.084], [0.181, 0.050, 0.094], material.metal, 0.004);
  box(pi, [0.003, 0.061, 0.063], [0.23, 0.050, 0.094], material.recess, 0.002);
  for (let i = 0; i < 6; i++) box(pi, [0.004, 0.003, 0.004], [0.232, 0.069, 0.073 + i * 0.008], material.gold, 0.0006);
  for (const [x, width] of [[-0.145, 0.050], [-0.062, 0.035], [0.003, 0.035]]) {
    box(pi, [width, 0.023, 0.032], [x, 0.019, 0.152], material.metal, 0.005);
    box(pi, [width - 0.012, 0.010, 0.003], [x, 0.019, 0.169], material.recess, 0.003);
  }
  box(pi, [0.294, 0.019, 0.028], [-0.023, 0.019, -0.128], material.charcoal, 0.002);
  for (let i = 0; i < 20; i++) {
    for (const z of [-0.135, -0.123]) pin(pi, -0.161 + i * 0.014, 0.039, z, 0.0025, 0.029, material.gold);
  }
  box(pi, [0.159, 0.035, 0.158], [-0.049, 0.031, 0.004], material.charcoal, 0.008);
  for (let i = 0; i < 10; i++) box(pi, [0.006, 0.048, 0.149], [-0.117 + i * 0.015, 0.051, 0.004], material.charcoal, 0.0017);
  pin(pi, -0.048, 0.078, 0.004, 0.056, 0.012, material.recess);
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.005, 8, 24), material.alloy);
  fanRing.rotation.x = Math.PI / 2;
  fanRing.position.set(-0.048, 0.085, 0.004);
  pi.add(fanRing);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const blade = box(pi, [0.029, 0.003, 0.012], [-0.048 + Math.cos(angle) * 0.026, 0.085, 0.004 + Math.sin(angle) * 0.026], material.alloy, 0.004);
    blade.rotation.y = -angle + 0.4;
  }
  pin(pi, -0.048, 0.087, 0.004, 0.012, 0.005, material.charcoal);
  for (let i = 0; i < 5; i++) box(pi, [0.018, 0.012, 0.010], [-0.183, 0.016, -0.06 + i * 0.025], material.pale, 0.0015);
  topLabel(pi, 'PI 5', 0.070, 0.017, [-0.117, 0.010, 0.105]);

  // The raised HAT leaves the Pi's cooler and side ports visible when orbiting.
  box(ai, [0.34, 0.017, 0.235], [0, 0, 0], material.pcb, 0.012);
  for (const x of [-0.153, 0.108]) {
    for (const z of [-0.088, 0.088]) {
      ai.add(rod(V(x, -0.216, z), V(x, -0.009, z), 0.007, material.gold, 12));
      pin(ai, x, 0.011, z, 0.009, 0.004);
    }
  }
  box(ai, [0.141, 0.022, 0.105], [-0.018, 0.021, 0.008], material.charcoal, 0.006);
  topLabel(ai, 'HAILO', 0.099, 0.022, [-0.018, 0.0325, 0.008], '#d3d8c6');
  topLabel(ai, 'AI HAT 2', 0.149, 0.022, [-0.008, 0.0095, -0.076]);
  box(ai, [0.045, 0.021, 0.050], [0.100, 0.020, 0.018], material.metal, 0.002);
  box(ai, [0.035, 0.008, 0.036], [0.100, 0.034, 0.018], material.charcoal, 0.003);
  for (let i = 0; i < 6; i++) {
    box(ai, [0.013, 0.009, 0.009], [-0.109 + i * 0.025, 0.013, 0.084], material.pale, 0.001);
    box(ai, [0.003, 0.001, 0.025], [-0.109 + i * 0.025, 0.009, 0.066], material.gold, 0.0004);
  }
  box(ai, [0.021, 0.029, 0.11], [-0.155, -0.022, -0.005], material.charcoal, 0.002);

  // Independent modules, each with the six holes in the corrected orientation.
  for(const [module,name] of [[mosfets,'FAN'],[mosfetLed,'LED']] as const) {
    box(module,[.21,.016,.355],[0,0,0],material.pcb,.009);
    for(const x of [-.087,.087]) for(const z of [-.150,.155]) pin(module,x,-.021,z,.008,.028,material.gold);
    for(const [name,point] of Object.entries(terminalOffsets)) {
      const [x,y,z] = point;
      box(module,[.082,.048,.050],[x,.032,z],material.terminal,.004);
      box(module,[.035,.003,.027],[x,y-.012,z],material.recess,.004);
      // A metal collar around a visible central wire-entry hole.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.013,.003,6,18),material.metal);
      ring.rotation.x=-Math.PI/2;ring.position.set(x,y-.005,z);module.add(ring);
      const socket = new THREE.Object3D();socket.name=name;socket.position.set(x,y,z);module.add(socket);
    }
    box(module,[.095,.003,.082],[-.025,.010,.023],material.metal,.002);
    box(module,[.076,.020,.072],[-.025,.024,.023],material.charcoal,.003);
    for(const z of [-.001,.023,.047]) box(module,[.046,.004,.008],[.032,.012,z],material.metal,.001);
    box(module,[.033,.012,.023],[.041,.018,.088],material.charcoal,.002);
    topLabel(module,name,.10,.026,[0,.012,-.164]);
    topLabel(module,'LOAD',.072,.017,[-.051,.012,-.022]);
    topLabel(module,'SUPPLY',.078,.017,[.051,.012,-.022]);
  }

  // A quiet, unlit backup-power enclosure beneath the bench.
  box(ups, [0.55, 0.70, 0.43], [0, 0, 0], material.charcoal, 0.035);
  box(ups, [0.505, 0.655, 0.012], [0, 0, 0.212], material.charcoal, 0.026);
  for (const x of [-0.195, 0.195]) {
    for (const z of [-0.137, 0.137]) box(ups, [0.07, 0.035, 0.07], [x, -0.3675, z], material.recess, 0.009);
  }
  for (let i = 0; i < 13; i++) {
    box(ups, [0.002, 0.008, 0.245], [0.2755, -0.17 + i * 0.024, -0.016], material.recess, 0.001);
  }
  for (let i = 0; i < 10; i++) box(ups, [0.011, 0.002, 0.19], [-0.174 + i * 0.038, 0.3505, -0.025], material.recess, 0.001);
  const powerButton = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.009, 24), material.recess);
  powerButton.rotation.x = Math.PI / 2;
  powerButton.position.set(0, 0.040, 0.222);
  ups.add(powerButton);
  const powerRing = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0013, 6, 20, Math.PI * 1.65), material.pale);
  powerRing.rotation.z = Math.PI * 0.675;
  powerRing.position.set(0, 0.040, 0.2275);
  ups.add(powerRing);
  box(ups, [0.0022, 0.013, 0.001], [0, 0.052, 0.229], material.pale, 0.0006);
  const apcLabel = inscription('APC', '#d6dac9', 0.26, 0.085);
  apcLabel.position.set(0, 0.235, 0.2195);
  ups.add(apcLabel);
  const schneiderLabel = inscription('by Schneider Electric', '#b8c1af', 0.35, 0.036);
  schneiderLabel.position.set(0, 0.159, 0.2195);
  ups.add(schneiderLabel);
  box(ups, [0.155, 0.003, 0.003], [0, -0.228, 0.220], material.alloy, 0.001);

  // Slim aluminium enclosure, deliberately separate from the Pi and power supply.
  box(ssd, [0.165, 0.047, 0.32], [0, 0, 0], material.charcoal, 0.011);
  box(ssd, [0.146, 0.003, 0.288], [0, 0.024, 0], material.alloy, 0.009);
  for (const x of [-0.054, 0.054]) {
    for (const z of [-0.119, 0.119]) box(ssd, [0.021, 0.008, 0.030], [x, -0.027, z], material.charcoal, 0.003);
  }
  for (const x of [-0.079, 0.079]) {
    for (const y of [-0.011, -0.001, 0.009]) box(ssd, [0.002, 0.002, 0.275], [x, y, 0], material.recess, 0.0007);
  }
  box(ssd, [0.043, 0.016, 0.003], [0, 0, -0.1605], material.metal, 0.004);
  box(ssd, [0.034, 0.010, 0.002], [0, 0, -0.1625], material.recess, 0.003);
  topLabel(ssd, 'UGREEN', 0.13, 0.032, [0, 0.026, 0.038], '#d2d8c8');

  for (const group of [furniture, pi, ai, mosfets, mosfetLed, ups, ssd]) mergeParts(group);
  return { furniture, pi, ai, mosfets, mosfetLed, ups, ssd };
}
