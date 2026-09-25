import { positions, add, type ItemId, type Point } from './layout';

export type Component = ItemId;
export type VisualAction = 'mushrooms'|'cover'|'wiring'|'fan'|'mist'|'light'|'camera'|'screen'|'cooling';
export const categories = ['The habitat','Air & light','Observation','The workbench','Power & wiring'] as const;
type Category = typeof categories[number];
export type ComponentInfo = {
  id:Component; number:string; label:string; category:Category; title:string; copy:string; note:string;
  focus:Point; zoom:number; action:VisualAction; link:string; linkLabel:string;
};
const item=(id:Component,label:string,category:Category,title:string,copy:string,options:Partial<Omit<ComponentInfo,'id'|'label'|'category'|'title'|'copy'|'number'>>={}):ComponentInfo => ({
  id,number:'',label,category,title,copy,note:'',
  focus:positions[id],zoom:3.4,action:'wiring',link:'#architecture',linkLabel:'Explore the system architecture',...options,
});
export const components:ComponentInfo[] = [
  item('bag','Upper growing bag','The habitat','A place for life to take hold.','A smaller straw-filled cultivation bag hangs from the upper internal PVC rack. A short tie loops directly over its central support.',{zoom:2.6,action:'mushrooms',link:'#cultivation',linkLabel:'Explore cultivation phases'}),
  item('bag2','Lower growing bag','The habitat','A second bag. Its own support.','The second cultivation bag hangs from the middle rack on a short tie, with room around it for air and observation.',{zoom:2.6,action:'mushrooms',link:'#cultivation',linkLabel:'Explore cultivation phases',note:'Both bags can be viewed with or without the illustrated oyster clusters.'}),
  item('frame','PVC frame & hanging racks','The habitat','Simple materials. A useful space.','The PVC structure follows the reference: an outer frame, intermediate side rails, and two internal racks with depth rails and central hanging supports.',{zoom:1.3,focus:[.55,2.15,-.12],action:'cover',link:'/documentation/#physical-setup',linkLabel:'Read the build notes',note:'The documented tent is approximately 185 cm high, 82 cm wide and 55 cm deep.'}),
  item('cover','Cover & access','The habitat','A boundary around the growing space.','Light plastic covering surrounds the frame, with zippered access, two camera windows, a high duct inlet and low ventilation openings.',{zoom:1.3,focus:[.55,2.15,-.12],action:'cover',link:'/documentation/#physical-setup',linkLabel:'Read the build notes',note:'Toggle the cover to inspect the internal supports and hardware.'}),
  item('cooler','Fresh desert air cooler','Air & light','A cooler path into the tent.','The Fresh-style evaporative cooler stands behind the left side of the habitat. Its ribbed duct rises above the upper Pi camera and directs air into the growing space.',{focus:[-.55,2.15,-.55],zoom:1.25,action:'cooling',note:'Use the cooler switch to show blue airflow. It starts switched off.'}),
  item('fan','Low exhaust fan','Air & light','Make room for fresh air.','The ventilation fan sits low on the right side, as in the reference. Its black cable splits into red and black conductors at the fan MOSFET.',{zoom:3.5,action:'fan',note:'Fan leads use the left terminals: black in the first hole from the top, red in the second.'}),
  item('vent','Passive air vent','Air & light','An opening on the other side.','A mesh vent sits low on the left side of the tent, opposite the fan. It has its own opening in the covering.',{zoom:3.2,action:'fan'}),
  item('humidity','Xiaomi humidifier','Air & light','Bring moisture into the habitat.','The humidifier stands beside the tent. Its flexible silver duct rises to an inlet near the top of the right side.',{focus:add(positions.humidity,[0,.45,0]),zoom:2.5,action:'mist',note:'Use the humidifier switch to show mist entering the tent.'}),
  item('duct','Silver duct & high inlet','Air & light','A path into the growing space.','The ribbed duct follows the reference route from the humidifier, bending toward the high inlet on the right side of the tent.',{zoom:2.3,action:'mist',note:'The mist illustration starts at the duct outlet inside the tent.'}),
  item('light','LED strip','Air & light','Light, when the experiment calls for it.','The LED strip illuminates the tent from above. Its cable returns to a dedicated MOSFET supplied by the 24 V adapter.',{zoom:2.3,action:'light',note:'Switch on the lighting to dim the surrounding scene and illuminate the tent.'}),
  item('camera','Upper tent camera','Observation','Notice what changes slowly.','The upper camera is mounted on the left side at the upper hanging level. Its own ribbon cable runs back to a camera connector on the Pi.',{zoom:3.3,action:'camera',link:'#observations',linkLabel:'View photographs & timelapse',note:'Use the camera switch to reveal its viewing cone.'}),
  item('camera2','Lower tent camera','Observation','A second angle on the habitat.','A second camera sits on the left side at the lower hanging level. It has a separate ribbon connection to the Pi.',{zoom:3.3,action:'camera',link:'#observations',linkLabel:'View photographs & timelapse',note:'Both cameras are mounted on the tent in this model; neither sits on the workbench.'}),
  item('sensor','White SCD41 sensor','Observation','A window into the air.','The smaller white sensor sits below the black probe on the rear-left upright. Its black jacket contains red, black, yellow and green conductors.',{zoom:4.4,note:'Each conductor joins its matching colour from the black sensor in a Wago before continuing to the T-cobbler.'}),
  item('sht','Black SHT31 sensor','Observation','Temperature and moisture, together.','The smaller black probe sits above the white sensor on the same upright. Its four conductors share the corresponding colour-coded Wago junctions.',{zoom:4.4,link:'#experiment',linkLabel:'Read the experiment purpose'}),
  item('table','Expanded workbench','The workbench','Room for the whole setup.','A wider tabletop makes room for the monitor, keyboard, mouse, computer, storage and breadboard. Backup power sits beneath it.',{zoom:1.8,focus:[-2.4,1.48,.03]}),
  item('monitor','Monitor','The workbench','A screen beside the experiment.','The monitor connects to a micro-HDMI port on the Pi. Select it to see a Grafana mock-up, then use the screen switch to turn it off or on.',{zoom:3.0,focus:add(positions.monitor,[0,.57,0]),action:'screen',link:'/documentation/#publication',linkLabel:'Read the data and publication notes'}),
  item('keyboard','Keyboard','The workbench','A way to work at the bench.','A wireless keyboard sits in front of the monitor, leaving the tabletop free of its cable.',{zoom:3.6}),
  item('mouse','Mouse','The workbench','A small companion to the keyboard.','The wireless mouse sits beside the keyboard, with the SSD between it and the fan MOSFET.',{zoom:4.5}),
  item('pi','Raspberry Pi 5','The workbench','The small computer behind it all.','The Pi connects to the cameras, T-cobbler, SSD and workstation peripherals. Its official USB-C power supply is plugged into the UPS.',{zoom:3.6,focus:add(positions.pi,[0,.08,0])}),
  item('ai','AI HAT 2','The workbench','A place for the next question.','The AI HAT 2 is shown above the Pi so its accelerator and the computer beneath remain visible.',{zoom:3.8,link:'#vision',linkLabel:'Explore the YOLO work'}),
  item('ssd','UGREEN SSD enclosure','The workbench','Keep a place for the record.','The SSD sits between the mouse and fan MOSFET, and connects to the Pi through a USB-A port. Its cable and USB-A plug are shown in the wiring layer.',{zoom:4.1,link:'#observations',linkLabel:'Explore the published media'}),
  item('breadboard','Breadboard','Power & wiring','Bring the connections together.','The breadboard supports the horizontal T-cobbler. The sensor and MOSFET wires terminate on the breakout itself; its ribbon connects to the Pi.',{zoom:4.4,note:'Colours and connection routes follow the supplied wiring description.'}),
  item('cobbler','T-cobbler & ribbon','Power & wiring','From the GPIO header to the breadboard.','A wide ribbon runs from the Pi’s GPIO header to the horizontal T-shaped breakout. Four Wago outputs and the bottom red and black MOSFET leads plug directly into its sockets.',{zoom:4.8,focus:add(positions.cobbler,[0,.04,0]),note:'The ribbon and breakout have one dedicated indicator.'}),
  item('mosfets','Fan MOSFET · 12 V','Power & wiring','From a signal to a switched circuit.','The fan’s black and red wires enter the left pair of upper terminals. The 12 V adapter connects to the right pair. Bottom terminals connect to the T-cobbler.',{zoom:5.5,note:'Top to bottom: black then red on both upper sides. Bottom left is red to the T-cobbler; bottom right is black.'}),
  item('mosfet-led','LED MOSFET · 24 V','Power & wiring','A separate path for the LED.','The LED’s black and red wires enter the left pair of upper terminals. The 24 V adapter connects to the right pair. Bottom terminals connect to the T-cobbler.',{zoom:5.5,note:'Top to bottom: black then red on both upper sides. Bottom left is red to the T-cobbler; bottom right is black.'}),
  ...(['red','black','yellow','green'] as const).map(color=>item(`wago-${color}`,`${color[0].toUpperCase()+color.slice(1)} Wago`,'Power & wiring',`Two ${color} wires. One junction.`,`The ${color} conductor from each tent sensor joins here. One ${color} wire continues from this connector to a socket on the T-cobbler.`,{zoom:5.8,note:'One separate three-way Wago is shown for each matching wire colour.'})),
  item('ups','APC UPS','Power & wiring','A little resilience behind the scenes.','The UPS supplies the Pi’s official charger and the floor power strip carrying the 12 V and 24 V adapters.',{zoom:2.8,link:'/documentation/#limitations',linkLabel:'Read the reliability notes'}),
  item('pi-power','Official Pi USB-C supply','Power & wiring','Power for the computer.','The official Pi charger plugs into the UPS. Its USB-C cable climbs to the computer’s USB-C power socket.',{zoom:4.0}),
  item('power-strip','Floor power strip','Power & wiring','Two adapters, supplied by the UPS.','The floor strip’s cable ends in an AC plug seated in the UPS. It carries the separate 12 V fan and 24 V LED adapters.',{zoom:3.7}),
  item('adapter12','12 V fan adapter','Power & wiring','A supply for the fan circuit.','The adapter’s black cable splits into black and red wires. Black goes to the first upper-right hole of the fan MOSFET; red goes to the second.',{zoom:4.8,note:'The left upper pair on that MOSFET is reserved for the fan leads.'}),
  item('adapter24','24 V LED adapter','Power & wiring','A supply for the lighting circuit.','The adapter’s black cable splits into black and red wires. Black goes to the first upper-right hole of the LED MOSFET; red goes to the second.',{zoom:4.8,note:'The left upper pair on that MOSFET is reserved for the LED leads.'}),
].map((component,index)=>({...component,number:String(index+1).padStart(2,'0')}));
export const componentById=Object.fromEntries(components.map(component=>[component.id,component])) as Record<Component,ComponentInfo>;

// Guided tours follow the three paths described in the system architecture. Captions
// restate the documented setup; the pulses along the wires are illustrative only.
export type TourRoute = 'observe' | 'respond' | 'record';
export type TourStep = {
  component: Component; title: string; text: string;
  also?: Component[]; demo?: 'fan' | 'mist' | 'light' | 'camera'; wires?: Component[]; reverse?: Component[];
  link?: string; linkLabel?: string;
};
export const tours: Record<TourRoute, { name: string; steps: TourStep[] }> = {
  observe: { name: 'Observe', steps: [
    { component: 'sht', title: 'Reading the air', text: 'Inside the tent, the black SHT31 probe measures temperature and humidity.', wires: ['sht'] },
    { component: 'sensor', title: 'Carbon dioxide', text: 'The white SCD41 below it measures carbon dioxide. A matching pair of sensors records the room outside the tent.', wires: ['sensor'] },
    { component: 'cobbler', title: 'Colour to colour', text: 'Their conductors join matching colours in Wago junctions, then continue to the T-cobbler on the breadboard.', also: ['wago-red', 'wago-black', 'wago-yellow', 'wago-green', 'breadboard'], wires: ['wago-red', 'wago-black', 'wago-yellow', 'wago-green'] },
    { component: 'pi', title: 'Collected on the Pi', text: 'Python services on the Raspberry Pi collect the readings. MQTT carries them to a writer, which saves their history.', also: ['cobbler'], wires: ['cobbler'], reverse: ['cobbler'] },
    { component: 'monitor', title: 'Charted in Grafana', text: 'Grafana queries that history and displays the experiment data. This screen shows a mock-up; the real dashboard lives in Grafana.', also: ['pi'], wires: ['monitor'], reverse: ['monitor'] },
  ] },
  respond: { name: 'Respond', steps: [
    { component: 'pi', title: 'A condition becomes a decision', text: 'Controllers consider the readings alongside the settings for the cultivation phase, then send their commands.', also: ['cobbler'], wires: ['cobbler'] },
    { component: 'mosfets', title: 'Switching the fan', text: 'A signal switches the fan’s MOSFET, closing the circuit from its 12 V adapter.', also: ['adapter12', 'cobbler'], wires: ['mosfets', 'adapter12'], reverse: ['mosfets'] },
    { component: 'fan', title: 'Fresh air', text: 'The low exhaust fan moves air through the tent, with a passive vent on the opposite side.', also: ['vent', 'mosfets'], demo: 'fan', wires: ['fan'], reverse: ['fan'] },
    { component: 'humidity', title: 'Moisture', text: 'The humidifier’s silver duct carries mist to a high inlet on the right side of the tent.', also: ['duct'], demo: 'mist' },
    { component: 'light', title: 'Light, when it is needed', text: 'A separate MOSFET, supplied by the 24 V adapter, switches the LED strip at the top of the tent.', also: ['mosfet-led'], demo: 'light', wires: ['light'], reverse: ['light'] },
  ] },
  record: { name: 'Record', steps: [
    { component: 'camera', title: 'Watching slowly', text: 'The upper camera looks into the growing space from the left side, through its own window in the cover.', demo: 'camera', wires: ['camera'] },
    { component: 'camera2', title: 'A second angle', text: 'A lower camera adds another view. Each camera has its own ribbon cable back to the Pi.', demo: 'camera', wires: ['camera2'] },
    { component: 'pi', title: 'On a schedule', text: 'A phase-aware scheduler captures still photographs. During incubation, each camera takes a full-resolution still every six hours.', also: ['camera', 'camera2'], wires: ['camera', 'camera2'] },
    { component: 'ssd', title: 'Keeping the record', text: 'The SSD beside the Pi keeps a place for the record.', also: ['pi'], wires: ['ssd'], reverse: ['ssd'] },
    { component: 'bag', title: 'Made visible', text: 'Selected stills and timelapses are prepared and published with the research, so slow changes can be seen.', also: ['bag2'], link: '#observations', linkLabel: 'View photographs & timelapse' },
  ] },
};
