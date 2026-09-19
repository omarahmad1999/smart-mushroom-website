import * as THREE from 'three';
import { roundedBox } from './hardware';

// Authored Fresh-style evaporative cooler. No connection to physical hardware.
export function createCooler() {
  const group=new THREE.Group();group.userData.component='cooler';
  const body=new THREE.Group();body.position.set(-1.03,.14,-1.87);group.add(body);
  const charcoal=new THREE.MeshStandardMaterial({color:'#292c2b',roughness:.55});
  const dark=new THREE.MeshStandardMaterial({color:'#111817',roughness:.65});
  const gold=new THREE.MeshStandardMaterial({color:'#b5a17a',metalness:.35,roughness:.42});
  const silver=new THREE.MeshStandardMaterial({color:'#a9b5b6',metalness:.65,roughness:.38});
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,r=.035)=>{
    const mesh=roundedBox(w,h,d,r,mat);mesh.position.set(x,y,z);body.add(mesh);return mesh;
  };
  box(.64,1.63,.52,0,.92,0,charcoal,.09);
  box(.56,.23,.47,0,1.72,.01,gold,.055);
  box(.54,.66,.035,0,1.25,.27,dark,.025);
  for(let i=0;i<11;i++)box(.50,.021,.06,0,.95+i*.055,.29,charcoal,.007);
  for(const x of [-.17,.17])box(.015,.62,.025,x,1.25,.324,charcoal,.005);
  for(const y of [1.08,1.35])box(.085,.032,.022,0,y,.33,gold,.012);
  for(const x of [-.16,.16]){
    const knob=new THREE.Mesh(new THREE.CylinderGeometry(.054,.054,.037,24),dark);
    knob.rotation.x=Math.PI/2;knob.position.set(x,1.74,.26);body.add(knob);
    box(.007,.032,.006,x,1.752,.282,gold,.002);
  }
  for(let i=0;i<4;i++)box(.47,.018,.015,0,.45+i*.095,.267,dark,.006);
  box(.042,.20,.014,0,.30,.273,gold,.018);
  box(.019,.15,.016,0,.30,.282,new THREE.MeshStandardMaterial({color:'#7dbec5',roughness:.25}),.007);
  for(const x of [-.23,.23])for(const z of [-.16,.16]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.066,.066,.05,16),dark);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x,.07,z);body.add(wheel);
  }
  const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;
  const ctx=labelCanvas.getContext('2d')!;ctx.fillStyle='#c9b98d';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText('FRESH',128,46);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.23,.058),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true,depthWrite:false}));
  label.position.set(0,.79,.278);body.add(label);

  // Adapter hood feeds a ribbed duct up the rear-left side, above the upper camera.
  box(.49,.31,.19,0,1.31,.40,charcoal,.04);
  const route=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.03,1.45,-1.39),new THREE.Vector3(-1.45,1.80,-1.27),
    new THREE.Vector3(-1.55,2.65,-1.20),new THREE.Vector3(-1.49,3.48,-1.04),
    new THREE.Vector3(-1.27,3.77,-.60),
    new THREE.Vector3(-.69,3.77,-.13),new THREE.Vector3(-.18,3.77,-.03),
  ]);
  const duct=new THREE.Mesh(new THREE.TubeGeometry(route,80,.115,16,false),silver);group.add(duct);
  const ringGeo=new THREE.TorusGeometry(.116,.008,5,20);
  for(let i=0;i<=65;i++){
    const ring=new THREE.Mesh(ringGeo,silver);const t=i/65;
    ring.position.copy(route.getPointAt(t));ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),route.getTangentAt(t));group.add(ring);
  }
  const outlet=new THREE.Mesh(new THREE.CylinderGeometry(.104,.104,.018,24),dark);
  outlet.rotation.z=Math.PI/2;outlet.position.set(-.17,3.77,-.03);group.add(outlet);

  const airflow=new THREE.Group();airflow.name='cooler-airflow';airflow.userData.ignorePicking=true;airflow.visible=false;group.add(airflow);
  const streams:Array<{mesh:THREE.Mesh;curve:THREE.CatmullRomCurve3;index:number}>=[];
  for(let lane=0;lane<5;lane++){
    const z=-.03+(lane-2)*.047;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.13,3.77,z),new THREE.Vector3(.30,3.73,z),new THREE.Vector3(.78,3.48,z+(lane-2)*.055),new THREE.Vector3(1.02,3.10,z+(lane-2)*.075)]);
    for(let i=0;i<3;i++){
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.010,5,false),new THREE.MeshBasicMaterial({color:lane%2?'#83dfed':'#39b7d3',transparent:true,opacity:.7,depthWrite:false}));
      mesh.layers.set(1);mesh.frustumCulled=false;airflow.add(mesh);streams.push({mesh,curve,index:i/3+lane*.06});
    }
  }
  const center=new THREE.Vector3(),tangent=new THREE.Vector3(),side=new THREE.Vector3(),normal=new THREE.Vector3();
  const up=new THREE.Vector3(0,0,1);
  function animate(seconds:number){
    for(const {mesh,curve,index} of streams){
      const phase=(seconds*.40+index)%1;
      const vertices=mesh.geometry.getAttribute('position');
      for(let j=0;j<=10;j++){
        const t=Math.min(1,phase+j*.014);
        curve.getPoint(t,center);curve.getTangent(t,tangent);
        side.crossVectors(tangent,up).normalize();normal.crossVectors(tangent,side).normalize();
        for(let k=0;k<=5;k++){
          const angle=k/5*Math.PI*2,c=Math.cos(angle)*.010,s=Math.sin(angle)*.010;
          vertices.setXYZ(j*6+k,center.x+side.x*c+normal.x*s,center.y+side.y*c+normal.y*s,center.z+side.z*c+normal.z*s);
        }
      }
      vertices.needsUpdate=true;
      (mesh.material as THREE.MeshBasicMaterial).opacity=Math.sin(phase*Math.PI)*.8;
    }
  }
  animate(.5);
  return {group,airflow,animate};
}
