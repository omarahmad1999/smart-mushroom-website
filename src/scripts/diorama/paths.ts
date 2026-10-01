// The connected-system paths as small 3D dioramas: platforms joined by glass tubes that carry light.
// Pure data, shared by the page markup (labels, steps, posters), the 3D scene and the Blender model
// (tools/diorama/layout-json.mjs). Positions are on the ground plane in world units: x runs down-right on
// screen, z down-left.

/** What stands on a part's platform. Software parts are glass cases with an icon inside; devices are modelled. */
export type Prop = 'case' | 'valve' | 'gate' | 'stack' | 'screen' | 'fan' | 'humidifier' | 'lights' | 'cameras' | 'photos';
export type Side = 'below' | 'above' | 'below-left' | 'below-right' | 'right' | 'left';
/** The icon in a glass case: its Phosphor duotone outline stays ink while the inside fills with colour on its turn,
 *  rising from the bottom, written from the top, or sweeping round like a timer. Its feel sets the fill's surface. */
export interface CaseIcon { svg: string; color: string; from?: 'bottom' | 'top' | 'sweep'; feel?: 'liquid' | 'gas' | 'ink' | 'solid'; python?: boolean; co2?: boolean }
/** What a part does when a message reaches it, and the sound it makes. */
export type Action = 'scribble' | 'tilt' | 'toggle' | 'chart' | 'film';
export interface DioramaPart { id: string; name: string; detail: string; prop: Prop; size: number; source?: boolean; final?: boolean; icon?: CaseIcon; action?: Action }
/** A dashed link is optional, like manual control: its light runs in dashes. */
export interface DioramaLink { id: string; from: string; to: string; dashed?: boolean }
/** `room` widens the margin left for labels at the top or bottom of the frame, in world units. */
export interface DioramaLayout { elevation: number; at: Record<string, [number, number]>; labels: Record<string, Side>; room?: { top?: number; bottom?: number } }
/** Messages travel stretch by stretch. A stretch may move several at once and then continue as one (merging in
 *  a valve), and its last phase may fan out to several parts, which all answer under the stretch's stage name.
 *  Sources wake just before the stretch leaves. */
export interface Stretch { phases: string[][]; stage: string; sources?: string[] }
export interface Diorama {
  name: string; completion: string; steps: string[];
  /** The stage while the first parts wake, and short captions shown while each stage plays. */
  start: string; captions: Record<string, string>;
  parts: DioramaPart[]; links: DioramaLink[]; stretches: Stretch[];
  layouts: { wide: DioramaLayout; narrow: DioramaLayout };
  crosslink?: { to: string; text: string; name: string };
}
export type Pathway = 'observe' | 'respond' | 'record';

export const dioramas: Record<Pathway, Diorama> = {
  observe: {
    name: 'Observe', completion: 'Grafana displays the stored measurements.',
    steps: [
      'The SHT31 and SCD41 sensors send their readings together. The two paths merge before Mosquitto, the MQTT broker.',
      'Mosquitto carries the published measurements to the database writer.',
      'The database writer stores the measurements in TimescaleDB.',
      'Grafana visualizes the stored measurements from TimescaleDB.',
    ],
    start: 'sensors',
    captions: {
      sensors: 'The sensors take their readings.',
      'to-mqtt': 'Both readings travel together and merge before Mosquitto.',
      'to-writer': 'Mosquitto carries the published measurements to the writer.',
      'to-timescale': 'The writer stores the measurements in TimescaleDB.',
      'to-grafana': 'Grafana visualizes the stored measurements.',
      grafana: 'Grafana displays the stored measurements.',
    },
    parts: [
      { id: 'sht31', name: 'SHT31', detail: 'Temperature, Humidity', prop: 'case', size: 1.3, source: true, icon: { svg: 'thermometer', color: '#e5484d', feel: 'liquid' } },
      { id: 'scd41', name: 'SCD41', detail: 'CO₂', prop: 'case', size: 1.3, source: true, icon: { svg: 'cloud', color: '#8ea3ad', feel: 'gas', co2: true } },
      { id: 'junction', name: '', detail: '', prop: 'valve', size: .62 },
      { id: 'mqtt', name: 'Mosquitto', detail: 'MQTT Broker', prop: 'gate', size: 1.55 },
      { id: 'writer', name: 'Database Writer', detail: 'Python Service', prop: 'case', size: 1.35, action: 'scribble', icon: { svg: 'notepad', color: '#2E8565', from: 'top', feel: 'ink', python: true } },
      { id: 'timescale', name: 'TimescaleDB', detail: 'Experiment History', prop: 'stack', size: 1.5 },
      { id: 'grafana', name: 'Grafana', detail: 'Dashboards', prop: 'screen', size: 1.7, final: true, action: 'chart' },
    ],
    links: [
      { id: 'sht31', from: 'sht31', to: 'junction' }, { id: 'scd41', from: 'scd41', to: 'junction' }, { id: 'merged', from: 'junction', to: 'mqtt' },
      { id: 'published', from: 'mqtt', to: 'writer' }, { id: 'stored', from: 'writer', to: 'timescale' }, { id: 'visualized', from: 'timescale', to: 'grafana' },
    ],
    stretches: [
      { phases: [['sht31', 'scd41'], ['merged']], stage: 'mqtt' },
      { phases: [['published']], stage: 'writer' },
      { phases: [['stored']], stage: 'timescale' },
      { phases: [['visualized']], stage: 'grafana' },
    ],
    layouts: {
      // A staircase left to right: each tube runs along one ground axis, like pipes on a bench.
      wide: {
        elevation: 33,
        at: { sht31: [-5.6, 1], scd41: [-3, 3.6], junction: [-3, 1], mqtt: [-.2, 1], writer: [-.2, -1.8], timescale: [2.6, -1.8], grafana: [2.6, -4.6] },
        labels: { sht31: 'above', scd41: 'below', mqtt: 'below', writer: 'above', timescale: 'below', grafana: 'above' },
      },
      // On a phone the sensors meet at the top and the path runs straight down the screen,
      // with each name to its right.
      narrow: {
        elevation: 38,
        at: { sht31: [0, -2.6], scd41: [-2.6, 0], junction: [0, 0], mqtt: [2.25, 2.25], writer: [4.5, 4.5], timescale: [6.75, 6.75], grafana: [9, 9] },
        labels: { sht31: 'above', scd41: 'above', mqtt: 'right', writer: 'right', timescale: 'right', grafana: 'right' },
      },
    },
    crosslink: { to: 'respond', text: 'These readings also feed the controllers', name: 'Respond' },
  },
  respond: {
    name: 'Respond', completion: 'The actuator services drive ventilation, moisture and lighting in the tent.',
    steps: [
      'Readings and phase settings provide the context for a decision.',
      'The controllers, Python services, evaluate the configured conditions and publish commands through Mosquitto, the MQTT broker.',
      'Home Assistant adds manual control, sending its commands the same way.',
      'Mosquitto routes the commands to the actuator services.',
      'The actuator services drive the fan, humidifier and LEDs.',
    ],
    start: 'inputs',
    captions: {
      inputs: 'Readings and phase settings give the context for a decision.',
      'to-controllers': 'The controllers evaluate the configured conditions.',
      'to-mqtt': 'Commands are published through Mosquitto; Home Assistant adds manual control.',
      'to-actuators': 'Mosquitto routes the commands to the actuator services.',
      'to-devices': 'The actuator services drive the fan, humidifier and LEDs.',
      devices: 'The actuator services drive ventilation, moisture and lighting in the tent.',
    },
    parts: [
      { id: 'inputs', name: 'Readings & Phase Settings', detail: 'Decision Context', prop: 'case', size: 1.3, source: true, icon: { svg: 'sliders-horizontal', color: '#D6A23E', feel: 'solid' } },
      { id: 'controllers', name: 'Controllers', detail: 'Environment & Lighting', prop: 'case', size: 1.3, action: 'tilt', icon: { svg: 'scales', color: '#2E8784', feel: 'solid', python: true } },
      { id: 'ha', name: 'Home Assistant', detail: 'Manual Control', prop: 'case', size: 1.3, source: true, icon: { svg: 'house', color: '#18BCF2', feel: 'solid' } },
      { id: 'mqtt', name: 'Mosquitto', detail: 'MQTT Broker', prop: 'gate', size: 1.55 },
      { id: 'actuators', name: 'Actuator Services', detail: 'Python Services', prop: 'case', size: 1.3, action: 'toggle', icon: { svg: 'toggle-right', color: '#3FA56B', feel: 'solid', python: true } },
      { id: 'fan', name: 'Fan', detail: 'Ventilation', prop: 'fan', size: 1.4, final: true },
      { id: 'humidifier', name: 'Humidifier', detail: 'Moisture', prop: 'humidifier', size: 1.3, final: true },
      { id: 'leds', name: 'LEDs', detail: 'Lighting', prop: 'lights', size: 1.5, final: true },
    ],
    links: [
      { id: 'evaluate', from: 'inputs', to: 'controllers' }, { id: 'commands', from: 'controllers', to: 'mqtt' }, { id: 'manual', from: 'ha', to: 'mqtt', dashed: true },
      { id: 'route', from: 'mqtt', to: 'actuators' },
      { id: 'drive-fan', from: 'actuators', to: 'fan' }, { id: 'drive-humidifier', from: 'actuators', to: 'humidifier' }, { id: 'drive-leds', from: 'actuators', to: 'leds' },
    ],
    stretches: [
      { phases: [['evaluate']], stage: 'controllers' },
      // Commands from the controllers and Home Assistant's manual control reach Mosquitto together.
      { phases: [['commands', 'manual']], stage: 'mqtt', sources: ['ha'] },
      { phases: [['route']], stage: 'actuators' },
      // The actuator services drive the three devices at once: the message splits three ways.
      { phases: [['drive-fan', 'drive-humidifier', 'drive-leds']], stage: 'devices' },
    ],
    layouts: {
      // The two command sources converge on the gate from the left, as the sensors do in Observe; the actuator
      // services fan out to the three devices on the right.
      wide: {
        elevation: 33,
        at: { inputs: [-4, 4], controllers: [-1.4, 4], ha: [-4, 1.4], mqtt: [-1.4, 1.4], actuators: [1, -1], fan: [1, -3.6], leds: [3.4, -3.4], humidifier: [3.6, -1] },
        labels: { inputs: 'above', controllers: 'below', ha: 'above', mqtt: 'below', actuators: 'below', fan: 'above', humidifier: 'below', leds: 'below' },
        // The lowest labels sit clear of the caption in the corner.
        room: { bottom: 1.25 },
      },
      // On a phone the path runs down the screen with its names to the right. Home Assistant joins from the left,
      // and the three devices spread across the bottom, the short humidifier under the actuator services' name.
      narrow: {
        elevation: 38,
        at: { inputs: [0, 0], controllers: [2, 2], mqtt: [4, 4], ha: [1.4, 4], actuators: [6, 6], leds: [6, 8.8], fan: [8, 8], humidifier: [8.8, 6] },
        labels: { inputs: 'right', controllers: 'right', mqtt: 'right', ha: 'above', actuators: 'right', fan: 'below', humidifier: 'below', leds: 'below' },
      },
    },
    crosslink: { to: 'observe', text: 'The sensors notice the change', name: 'Observe' },
  },
  record: {
    name: 'Record', completion: 'Selected photographs and completed timelapses form the visual record.',
    steps: [
      'The capture schedule uses a systemd timer, with timing following the cultivation phase.',
      'Two cameras photograph the tent and ambient view using Camera Module 3 Wide cameras.',
      'Image storage keeps the captured still photographs as local media files.',
      'Media preparation selects images and produces completed timelapses.',
    ],
    start: 'schedule',
    captions: {
      schedule: 'The capture schedule follows the cultivation phase.',
      'to-cameras': 'The systemd timer triggers a capture.',
      'to-storage': 'Both cameras save their photographs as local media files.',
      'to-media': 'Media preparation selects images for a timelapse.',
      media: 'Selected photographs and completed timelapses form the visual record.',
    },
    parts: [
      { id: 'schedule', name: 'Capture Schedule', detail: 'systemd Timer', prop: 'case', size: 1.3, source: true, icon: { svg: 'timer', color: '#D49A3A', from: 'sweep', feel: 'solid' } },
      { id: 'cameras', name: 'Two Cameras', detail: 'Camera Module 3 Wide', prop: 'cameras', size: 1.5 },
      { id: 'storage', name: 'Image Storage', detail: 'Local Media Files', prop: 'photos', size: 1.4 },
      { id: 'media', name: 'Media Preparation', detail: 'Timelapses', prop: 'screen', size: 1.7, final: true, action: 'film' },
    ],
    links: [{ id: 'trigger', from: 'schedule', to: 'cameras' }, { id: 'save', from: 'cameras', to: 'storage' }, { id: 'prepare', from: 'storage', to: 'media' }],
    stretches: [
      { phases: [['trigger']], stage: 'cameras' },
      { phases: [['save']], stage: 'storage' },
      { phases: [['prepare']], stage: 'media' },
    ],
    layouts: {
      // The same staircase as Observe, spaced out so the four parts stand at the same scale.
      wide: {
        elevation: 33,
        at: { schedule: [-3.4, 1.7], cameras: [0, 1.7], storage: [0, -1.7], media: [3.4, -1.7] },
        labels: { schedule: 'above', cameras: 'below', storage: 'above', media: 'below' },
      },
      narrow: {
        elevation: 38,
        at: { schedule: [0, 0], cameras: [2.25, 2.25], storage: [4.5, 4.5], media: [6.75, 6.75] },
        labels: { schedule: 'right', cameras: 'right', storage: 'right', media: 'right' },
      },
    },
  },
};
