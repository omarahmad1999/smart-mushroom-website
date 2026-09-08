import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

// Check the actual cable paths used to build geometry against the requested
// connections. This runs without a browser, network services or experiment data.
test('model wiring follows the corrected MOSFET sides and paired sensor junctions', async () => {
  const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
  try {
    const {createWiring}=await server.ssrLoadModule('/src/scripts/study/wiring.ts');
    const {positions:p,cobblerPoint,cobblerRibbonPoint,stripPlug}=await server.ssrLoadModule('/src/scripts/study/layout.ts');
    const root=createWiring();
    const routes=root.userData.connections as {name:string;points:number[][];color:string}[];
    const route=(name:string)=>{const result=routes.find(r=>r.name===name);expect(result,name).toBeTruthy();return result!;};
    const local=(point:number[],origin:number[])=>point.map((value,i)=>value-origin[i]);
    const close=(point:number[],target:number[])=>point.forEach((value,i)=>expect(value).toBeCloseTo(target[i],6));
    for(const [module,device,adapter] of [['mosfets','fan','adapter12'],['mosfet-led','light','adapter24']]) {
      for(const [color,z] of [['black',-.119],['red',-.058]] as const) {
        close(local(route(`${device}-${color}-to-left`).points.at(-1)!,p[module]),[-.051,.069,z]);
        close(local(route(`${adapter}-${color}-to-right`).points.at(-1)!,p[module]),[.051,.069,z]);
      }
      for(const [color,x] of [['red',-.051],['black',.051]] as const) {
        const connection=route(`${module}-bottom-${color}-to-cobbler`);
        close(local(connection.points[0],p[module]),[x,.069,.137]);
        close(connection.points.at(-1)!,cobblerPoint(`${module==='mosfets'?'fan':'led'}-${color}`));
      }
    }
    for(const color of ['red','black','yellow','green']) {
      const wago=p[`wago-${color}`];
      for(const [sensor,x] of [['sensor',-.047],['sht',.047]] as const) {
        const connection=route(`${sensor}-${color}-to-wago`);
        close(local(connection.points.at(-1)!,wago),[x,0,-.058]);
        expect(connection.color).toBe(route(`wago-${color}-to-cobbler`).color);
      }
      close(local(route(`wago-${color}-to-cobbler`).points[0],wago),[0,0,.058]);
      close(route(`wago-${color}-to-cobbler`).points.at(-1)!,cobblerPoint(color));
    }
    close(local(route('ugreen-ssd-usba-to-pi').points.at(-1)!,p.pi),[.232,.058,-.106]);
    close(local(route('official-supply-usbc-to-pi').points.at(-1)!,p.pi),[-.145,.019,.169]);
    close(route('pi-gpio-to-t-cobbler').points.at(-1)!,cobblerRibbonPoint());
    close(local(route('monitor-micro-hdmi-to-pi').points.at(-1)!,p.pi),[-.062,.019,.169]);
    expect(routes.some(r=>r.name.startsWith('keyboard-')||r.name.startsWith('mouse-'))).toBe(false);
    expect(p.ssd[0]).toBeGreaterThan(p.mouse[0]);expect(p.ssd[0]).toBeLessThan(p.mosfets[0]);
    const upsRear=p.ups[2]-.43/2;
    for(const head of [p['pi-power'],stripPlug]) {
      expect(head[2]+.064+.051/2).toBeGreaterThan(upsRear);
      expect(head[2]+.09/2).toBeLessThan(upsRear);
    }
    close(route('ups-to-floor-strip').points[0],stripPlug.map((n:number,i:number)=>n+(i===2?-.075:0)));
    expect(route('camera-to-pi').points[0][1]).toBeGreaterThan(3);
    expect(route('camera2-to-pi').points[0][1]).toBeGreaterThan(1.8);
    expect(new Set(routes.map(r=>r.name)).size).toBe(routes.length);
    root.traverse((object:any)=>{
      const position=object.geometry?.attributes.position;
      if(position)expect([...position.array].every(Number.isFinite)).toBe(true);
    });
  } finally {await server.close();}
});
