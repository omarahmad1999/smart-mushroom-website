import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBox, rod, tube, inscription } from './hardware';
import { positions } from './layout';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);


/** The equipment is an illustrative reconstruction, with no device connections. */
export function createDevices() {
  const porcelain = new THREE.MeshStandardMaterial({ color: '#e9e8df', roughness: 0.57 });
  const ivory = new THREE.MeshStandardMaterial({ color: '#e2decd', roughness: 0.63 });
  const charcoal = new THREE.MeshStandardMaterial({ color: '#454b44', roughness: 0.69 });
  const dark = new THREE.MeshStandardMaterial({ color: '#282f2c', roughness: 0.6 });
  const sage = new THREE.MeshStandardMaterial({ color: '#82947e', roughness: 0.72 });
  const pcb = new THREE.MeshStandardMaterial({ color: '#5f8771', roughness: 0.71 });
  const silver = new THREE.MeshStandardMaterial({ color: '#a8aca2', roughness: 0.53, metalness: 0.42 });
  const copper = new THREE.MeshStandardMaterial({ color: '#b48659', roughness: 0.56, metalness: 0.23 });
  const blue = new THREE.MeshStandardMaterial({ color: '#899eac', roughness: 0.48 });
  const groupFor = (id: string, name: string) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.component = id;
    return group;
  };
  const merge = (parts: THREE.BufferGeometry[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parts.forEach(part => part.dispose());
    return mesh;
  };
  const cylinder = (radius: number, height: number, material: THREE.Material, bottomRadius = radius) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, bottomRadius, height, 32), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const fan = groupFor('fan', 'Low right-side ventilation fan');
  fan.position.set(...positions.fan);
  fan.rotation.z = -Math.PI/2;
  fan.scale.setScalar(1.2);
  const outline = new THREE.Shape();
  const half = 0.185;
  const corner = 0.028;
  outline.moveTo(-half + corner, -half);
  outline.lineTo(half - corner, -half);
  outline.quadraticCurveTo(half, -half, half, -half + corner);
  outline.lineTo(half, half - corner);
  outline.quadraticCurveTo(half, half, half - corner, half);
  outline.lineTo(-half + corner, half);
  outline.quadraticCurveTo(-half, half, -half, half - corner);
  outline.lineTo(-half, -half + corner);
  outline.quadraticCurveTo(-half, -half, -half + corner, -half);
  const aperture = new THREE.Path();
  aperture.absarc(0, 0, 0.153, 0, Math.PI * 2, true);
  outline.holes.push(aperture);
  const housingGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.066, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.006, bevelThickness: 0.006, curveSegments: 32 });
  housingGeometry.rotateX(-Math.PI / 2);
  housingGeometry.translate(0, -0.033, 0);
  const housing = new THREE.Mesh(housingGeometry, charcoal);
  housing.castShadow = housing.receiveShadow = true;
  fan.add(housing);
  const fanRotor = new THREE.Group();
  fanRotor.name = 'Ventilation rotor';
  fan.add(fanRotor);
  const hub = cylinder(0.044, 0.044, ivory);
  fanRotor.add(hub);
  const blade = new THREE.Shape();
  blade.moveTo(0.029, -0.013);
  blade.bezierCurveTo(0.062, -0.027, 0.119, -0.04, 0.139, -0.026);
  blade.bezierCurveTo(0.158, -0.011, 0.142, 0.018, 0.124, 0.038);
  blade.bezierCurveTo(0.10, 0.053, 0.051, 0.034, 0.029, 0.013);
  blade.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.0025, bevelThickness: 0.0025, curveSegments: 10 });
  bladeGeometry.rotateX(-Math.PI / 2);
  const bladeParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) bladeParts.push(bladeGeometry.clone().rotateY(i * Math.PI * 2 / 7));
  bladeGeometry.dispose();
  fanRotor.add(merge(bladeParts, porcelain));
  const hubCap = cylinder(0.022, 0.004, charcoal);
  hubCap.position.y = 0.025;
  fanRotor.add(hubCap);
  const grilleParts: THREE.BufferGeometry[] = [];
  for (const radius of [0.065, 0.108, 0.149]) {
    const ring = new THREE.TorusGeometry(radius, 0.003, 5, 40);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0.041, 0);
    grilleParts.push(ring);
  }
  for (const turn of [0, Math.PI / 2]) {
    const bar = new THREE.CylinderGeometry(0.0028, 0.0028, 0.31, 6);
    bar.rotateZ(Math.PI / 2);
    bar.rotateY(turn);
    bar.translate(0, 0.041, 0);
    grilleParts.push(bar);
  }
  fan.add(merge(grilleParts, silver));
  const screws: THREE.BufferGeometry[] = [];
  for (const x of [-0.161, 0.161]) for (const z of [-0.161, 0.161]) {
    const screw = new THREE.CylinderGeometry(0.010, 0.010, 0.005, 12);
    screw.translate(x, 0.041, z);
    screws.push(screw);
  }
  fan.add(merge(screws, silver));
  const airflow = new THREE.Group();
  airflow.name = 'fan-airflow';
  airflow.visible = false;
  const airMaterial = new THREE.MeshBasicMaterial({ color: '#a3b4a1', transparent: true, opacity: 0.46, depthWrite: false });
  for (const x of [-0.08, 0, 0.08]) {
    const line = tube([[x, 0.09, 0], [x - 0.015, 0.21, 0], [x + 0.02, 0.32, 0], [x + 0.012, 0.42, 0]], 0.006, airMaterial, 18);
    line.castShadow = false;
    airflow.add(line);
  }
  fan.add(airflow);

  const humidity = groupFor('humidity', 'Xiaomi humidifier');
  const duct = groupFor('duct', 'High inlet and flexible silver duct');
  const humidifier = new THREE.Group();
  humidifier.name = 'Cylindrical humidifier';
  humidifier.position.set(...positions.humidity);
  humidity.add(humidifier);
  const base = cylinder(0.263, 0.166, porcelain, 0.247);
  base.position.y = 0.096;
  humidifier.add(base);
  const bodyProfile = [[0, 0.181], [0.25, 0.181], [0.267, 0.195], [0.272, 0.218], [0.272, 0.805], [0.267, 0.831], [0.252, 0.843], [0, 0.843]].map(([x, y]) => new THREE.Vector2(x, y));
  const tank = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 56), porcelain);
  tank.castShadow = tank.receiveShadow = true;
  humidifier.add(tank);
  const seam = cylinder(0.266, 0.005, ivory);
  seam.position.y = 0.181;
  humidifier.add(seam);
  const foot = cylinder(0.23, 0.018, sage);
  foot.position.y = 0.009;
  humidifier.add(foot);
  const gauge = roundedBox(0.023, 0.40, 0.009, 0.007, blue);
  gauge.position.set(0, 0.543, 0.272);
  humidifier.add(gauge);
  const gaugeMark = roundedBox(0.030, 0.010, 0.002, 0.002, porcelain);
  gaugeMark.position.set(0, 0.529, 0.277);
  humidifier.add(gaugeMark);
  const buttonRing = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.003, 6, 24), silver);
  buttonRing.position.set(0, 0.093, 0.262);
  humidifier.add(buttonRing);
  const buttonCentre = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), ivory);
  buttonCentre.position.set(0, 0.093, 0.263);
  humidifier.add(buttonCentre);
  const nozzle = cylinder(0.107, 0.050, porcelain);
  nozzle.position.set(0, 0.858, 0);
  humidifier.add(nozzle);
  const ductCurve = new THREE.CatmullRomCurve3([
    V(2.42,1.00,-.12),V(2.44,1.39,-.12),V(2.30,1.66,-.12),
    V(2.04,1.89,-.13),V(1.86,2.13,-.14),V(1.84,2.62,-.15),
    V(1.72,2.93,-.15),V(1.43,3.09,-.15),V(1.23,3.09,-.15),
  ]);
  const ductMaterial = new THREE.MeshStandardMaterial({ color: '#b0b1a6', roughness: 0.57, metalness: 0.38 });
  const ductSkin = new THREE.Mesh(new THREE.TubeGeometry(ductCurve, 72, 0.103, 24, false), ductMaterial);
  ductSkin.castShadow = ductSkin.receiveShadow = true;
  duct.add(ductSkin);
  const ribs: THREE.BufferGeometry[] = [];
  for (let index = 1; index < 62; index++) {
    const t = index / 62;
    const ring = new THREE.TorusGeometry(0.105, 0.009, 6, 24);
    const direction = ductCurve.getTangent(t).normalize();
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), direction));
    const point = ductCurve.getPoint(t);
    ring.translate(point.x, point.y, point.z);
    ribs.push(ring);
  }
  duct.add(merge(ribs, silver));
  const outlet = rod(V(1.39, 3.09, -0.15), V(1.22, 3.09, -0.15), 0.119, ivory, 28);
  duct.add(outlet);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.093, 28), charcoal);
  bore.rotation.y = -Math.PI / 2;
  bore.position.set(1.213, 3.09, -0.15);
  duct.add(bore);
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = mistCanvas.height = 64;
  const mistContext = mistCanvas.getContext('2d')!;
  const mistGradient = mistContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  mistGradient.addColorStop(0, 'rgba(255,255,246,0.82)');
  mistGradient.addColorStop(0.35, 'rgba(255,255,246,0.36)');
  mistGradient.addColorStop(1, 'rgba(255,255,246,0)');
  mistContext.fillStyle = mistGradient;
  mistContext.fillRect(0, 0, 64, 64);
  const mistPositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    const t = i / 120;
    const angle = i * 2.39996;
    mistPositions[i * 3] = 1.205 - t * 1.02;
    mistPositions[i * 3 + 1] = 3.09 + Math.sin(angle) * (0.02 + t * 0.19) - t * 0.18;
    mistPositions[i * 3 + 2] = -0.15 + Math.cos(angle) * (0.015 + t * 0.28);
  }
  const mistGeometry = new THREE.BufferGeometry();
  mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mist = new THREE.Points(mistGeometry, new THREE.PointsMaterial({ color: '#bed0cb', size: 12, map: new THREE.CanvasTexture(mistCanvas), opacity: 0.60, transparent: true, depthWrite: false, sizeAttenuation: false }));
  mist.name = 'Illustrative mist';
  mist.userData.basePositions = mistPositions.slice();
  mist.visible = false;
  duct.add(mist);

  const light = groupFor('light', 'Diagonal roof LED strip');
  const ledAngle=-Math.atan2(1.14,1.70);
  const rail=roundedBox(2.04,.030,.045,.007,ivory);
  rail.position.set(.55,4.082,-.12);rail.rotation.y=ledAngle;light.add(rail);
  const ledMaterial=new THREE.MeshStandardMaterial({color:'#fff4d3',roughness:.52,emissive:'#ffe4a2',emissiveIntensity:.08});
  const leds:THREE.BufferGeometry[]=[];
  for(let i=0;i<24;i++) {
    const t=-.966+i*.084;
    const pill=new RoundedBoxGeometry(.056,.007,.029,2,.003);
    pill.rotateY(ledAngle);
    pill.translate(.55+Math.cos(ledAngle)*t,4.101,-.12-Math.sin(ledAngle)*t);leds.push(pill);
  }
  const emitters=merge(leds,ledMaterial);emitters.castShadow=false;light.add(emitters);
  const lightEmitters: THREE.Mesh[] = [emitters];
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.17, 4.00, 0.38, 1.27, 4.00, 0.38, 1.38, 2.64, 0.16,
    -0.17, 4.00, 0.38, 1.38, 2.64, 0.16, -0.28, 2.64, 0.16,
  ], 3));
  beamGeometry.computeVertexNormals();
  const lightBeam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: '#ffedb4', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  lightBeam.name = 'light-beam';
  lightBeam.visible = false;
  light.add(lightBeam);

  function cameraModule() {
    const group = new THREE.Group();
    const board = roundedBox(0.245, 0.245, 0.024, 0.013, pcb);
    group.add(board);
    const chip = roundedBox(0.075, 0.045, 0.014, 0.002, dark);
    chip.position.set(0, 0.076, 0.022);
    group.add(chip);
    const lensMount = roundedBox(0.125, 0.123, 0.027, 0.017, silver);
    lensMount.position.set(0, -0.023, 0.031);
    group.add(lensMount);
    const barrel = cylinder(0.053, 0.072, charcoal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.023, 0.081);
    group.add(barrel);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.038, 28), new THREE.MeshStandardMaterial({ color: '#223c37', metalness: 0.38, roughness: 0.21 }));
    glass.position.set(0, -0.023, 0.118);
    group.add(glass);
    const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.004, 6, 28), dark);
    lensRim.position.set(0, -0.023, 0.117);
    group.add(lensRim);
    const screwParts: THREE.BufferGeometry[] = [];
    for (const x of [-0.097, 0.097]) for (const y of [-0.097, 0.097]) {
      const screw = new THREE.CylinderGeometry(0.010, 0.010, 0.012, 12);
      screw.rotateX(Math.PI / 2);
      screw.translate(x, y, 0.024);
      screwParts.push(screw);
    }
    group.add(merge(screwParts, silver));
    const contacts = new THREE.BoxGeometry(0.108, 0.023, 0.007);
    contacts.translate(0, -0.108, 0.014);
    group.add(new THREE.Mesh(contacts, copper));
    const bracket = roundedBox(0.276, 0.035, 0.14, 0.009, ivory);
    bracket.position.set(0, -0.155, -0.034);
    group.add(bracket);
    const support = roundedBox(0.06, 0.23, 0.035, 0.009, ivory);
    support.position.set(0, -0.065, -0.047);
    group.add(support);
    return group;
  }
  const camera = groupFor('camera', 'Upper tent camera');
  const controlledCamera = cameraModule();
  controlledCamera.name = 'Controlled tent camera';
  controlledCamera.position.set(...positions.camera);
  controlledCamera.scale.setScalar(.76);
  controlledCamera.quaternion.setFromUnitVectors(V(0, 0, 1), V(1,-.08,-.02).normalize());
  camera.add(controlledCamera);
  const cameraField = new THREE.Group();
  cameraField.name = 'Illustrative camera field of view';
  cameraField.position.copy(controlledCamera.position);
  cameraField.quaternion.copy(controlledCamera.quaternion);
  cameraField.visible = false;
  const corners = [V(-0.43, -0.32, 1.12), V(0.43, -0.32, 1.12), V(0.43, 0.28, 1.12), V(-0.43, 0.28, 1.12)];
  const origin = V(0, -0.023, 0.125);
  const fieldLinePositions: number[] = [];
  const fieldSurfacePositions: number[] = [];
  for (let i = 0; i < 4; i++) {
    fieldLinePositions.push(...origin.toArray(), ...corners[i].toArray(), ...corners[i].toArray(), ...corners[(i + 1) % 4].toArray());
    fieldSurfacePositions.push(...origin.toArray(), ...corners[i].toArray(), ...corners[(i + 1) % 4].toArray());
  }
  const fieldLines = new THREE.BufferGeometry();
  fieldLines.setAttribute('position', new THREE.Float32BufferAttribute(fieldLinePositions, 3));
  cameraField.add(new THREE.LineSegments(fieldLines, new THREE.LineBasicMaterial({ color: '#af9060', transparent: true, opacity: 0.42, depthWrite: false })));
  const fieldSurfaces = new THREE.BufferGeometry();
  fieldSurfaces.setAttribute('position', new THREE.Float32BufferAttribute(fieldSurfacePositions, 3));
  cameraField.add(new THREE.Mesh(fieldSurfaces, new THREE.MeshBasicMaterial({ color: '#c6ad77', side: THREE.DoubleSide, transparent: true, opacity: 0.045, depthWrite: false })));
  camera.add(cameraField);
  const camera2 = groupFor('camera2','Lower tent camera');
  const lowerCamera = cameraModule();
  lowerCamera.position.set(...positions.camera2);
  lowerCamera.scale.setScalar(.76);
  lowerCamera.quaternion.setFromUnitVectors(V(0,0,1),V(1,-.08,-.02).normalize());
  camera2.add(lowerCamera);
  const cameraField2 = cameraField.clone(true);
  cameraField2.position.copy(lowerCamera.position);
  cameraField2.quaternion.copy(lowerCamera.quaternion);
  camera2.add(cameraField2);

  function scdEnclosure() {
    const group = new THREE.Group();
    const body = roundedBox(0.25, 0.39, 0.09, 0.023, porcelain);
    body.position.z = -0.005;
    group.add(body);
    const face = roundedBox(0.213, 0.351, 0.003, 0.018, charcoal);
    face.position.z = 0.043;
    group.add(face);
    const parts: THREE.BufferGeometry[] = [];
    const grille = (w: number, h: number, x: number, y: number) => {
      const piece = new RoundedBoxGeometry(w, h, 0.012, 2, 0.003);
      piece.translate(x, y, 0.05);
      parts.push(piece);
    };
    for (const x of [-0.112, 0.112]) grille(0.023, 0.359, x, 0);
    for (const y of [-0.179, -0.099, 0.099, 0.179]) grille(0.235, 0.016, 0, y);
    grille(0.235, 0.063, 0, 0);
    for (let col = -5; col <= 5; col++) for (const y of [-0.136, -0.061, 0.061, 0.136]) grille(0.012, 0.071, col * 0.019, y);
    group.add(merge(parts, porcelain));
    const tab = roundedBox(0.12, 0.062, 0.05, 0.015, new THREE.MeshStandardMaterial({ color: '#b76e56', roughness: 0.64 }));
    tab.position.set(0, 0.21, -0.025);
    group.add(tab);
    const screw = cylinder(0.012, 0.01, silver);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, 0.216, 0.004);
    group.add(screw);
    const label = inscription('SCD41', '#818a7a', 0.15, 0.02);
    label.position.set(0, 0, 0.057);
    group.add(label);
    return group;
  }
  const sensor = groupFor('sensor', 'Tent SCD41 sensor');
  const controlledSensor = scdEnclosure();
  controlledSensor.name = 'Controlled SCD41';
  controlledSensor.position.set(...positions.sensor);
  controlledSensor.scale.setScalar(.53);
  sensor.add(controlledSensor);
  function shtProbe() {
    const group = new THREE.Group();
    const body = cylinder(0.052, 0.285, charcoal);
    body.position.y = -0.055;
    group.add(body);
    const wrap = cylinder(0.0526, 0.115, ivory);
    wrap.position.y = -0.10;
    group.add(wrap);
    const inner = cylinder(0.041, 0.138, ivory);
    inner.position.y = 0.151;
    group.add(inner);
    const grilleParts: THREE.BufferGeometry[] = [];
    for (const y of [0.082, 0.222]) {
      const rim = new THREE.CylinderGeometry(0.054, 0.054, 0.018, 24);
      rim.translate(0, y, 0);
      grilleParts.push(rim);
    }
    for (let i = 0; i < 7; i++) {
      const theta = i * Math.PI * 2 / 7;
      const bar = new THREE.BoxGeometry(0.013, 0.142, 0.013);
      bar.rotateY(-theta);
      bar.translate(Math.cos(theta) * 0.046, 0.153, Math.sin(theta) * 0.046);
      grilleParts.push(bar);
    }
    group.add(merge(grilleParts, charcoal));
    const mounting = roundedBox(0.185, 0.045, 0.027, 0.012, charcoal);
    mounting.position.set(0, 0.068, -0.052);
    group.add(mounting);
    const screws: THREE.BufferGeometry[] = [];
    for (const x of [-0.068, 0.068]) {
      const screw = new THREE.CylinderGeometry(0.009, 0.009, 0.007, 10);
      screw.rotateX(Math.PI / 2);
      screw.translate(x, 0.068, -0.035);
      screws.push(screw);
    }
    group.add(merge(screws, silver));
    const outlet = cylinder(0.022, 0.046, charcoal, 0.017);
    outlet.position.y = -0.217;
    group.add(outlet);
    const label = inscription('SHT31', '#6b7161', 0.087, 0.015);
    label.position.set(0, -0.098, 0.053);
    group.add(label);
    return group;
  }
  const sht = groupFor('sht', 'Tent SHT31 probe');
  const controlledSht = shtProbe();
  controlledSht.name = 'Controlled SHT31';
  controlledSht.position.set(...positions.sht);
  controlledSht.scale.setScalar(.53);
  sht.add(controlledSht);
  const vent = groupFor('vent','Low left-side passive air vent');
  vent.position.set(...positions.vent);
  const ventFrame = new THREE.Mesh(new THREE.BoxGeometry(.025,.45,.45),ivory);
  vent.add(ventFrame);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(.027,.40,.40),dark);vent.add(inset);
  const ventGrilleParts: THREE.BufferGeometry[] = [];
  for(let i=0;i<16;i++) {
    const t=-.185+i*.0246;
    const horizontal = new THREE.BoxGeometry(.03,.004,.39);horizontal.translate(0,t,0);ventGrilleParts.push(horizontal);
    const vertical = new THREE.BoxGeometry(.03,.39,.004);vertical.translate(0,0,t);ventGrilleParts.push(vertical);
  }
  vent.add(merge(ventGrilleParts,silver));
  return {fan,humidity,duct,vent,light,camera,camera2,sensor,sht,fanRotor,mist,cameraField,cameraField2,lightEmitters};
}
