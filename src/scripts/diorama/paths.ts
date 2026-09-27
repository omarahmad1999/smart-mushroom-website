// The connected-system paths as small 3D dioramas: platforms joined by glass tubes that carry light.
// Pure data, shared by the page markup (labels, steps, posters) and the 3D scene.
// Positions are on the ground plane in world units: x runs down-right on screen, z down-left.

export type Prop = 'sensor' | 'valve' | 'gate' | 'writer' | 'stack' | 'screen';
export type Side = 'below' | 'above' | 'below-left' | 'below-right' | 'right';
export interface DioramaPart { id: string; name: string; detail: string; prop: Prop; size: number; source?: boolean; final?: boolean }
export interface DioramaLink { id: string; from: string; to: string }
export interface DioramaLayout { elevation: number; at: Record<string, [number, number]>; labels: Record<string, Side> }
export interface Diorama {
  name: string; completion: string; steps: string[];
  /** Short captions shown while each stage plays. */
  captions: Record<string, string>;
  parts: DioramaPart[]; links: DioramaLink[];
  /** Messages travel stretch by stretch; a stretch may move several at once, then continue as one. */
  stretches: { phases: string[][]; stage: string }[];
  layouts: { wide: DioramaLayout; narrow: DioramaLayout };
  crosslink?: { to: string; text: string; name: string };
}

export const dioramas: Record<'observe', Diorama> = {
  observe: {
    name: 'Observe', completion: 'Grafana displays the stored measurements.',
    steps: [
      'The SHT31 and SCD41 sensors send their readings together. The two paths merge before Mosquitto, the MQTT broker.',
      'Mosquitto carries the published measurements to the database writer.',
      'The database writer stores the measurements in TimescaleDB.',
      'Grafana visualizes the stored measurements from TimescaleDB.',
    ],
    captions: {
      sensors: 'The sensors take their readings.',
      'to-mqtt': 'Both readings travel together and merge before Mosquitto.',
      'to-writer': 'Mosquitto carries the published measurements to the writer.',
      'to-timescale': 'The writer stores the measurements in TimescaleDB.',
      'to-grafana': 'Grafana visualizes the stored measurements.',
      grafana: 'Grafana displays the stored measurements.',
    },
    parts: [
      { id: 'sht31', name: 'SHT31', detail: 'temperature, humidity', prop: 'sensor', size: 1.3, source: true },
      { id: 'scd41', name: 'SCD41', detail: 'CO₂', prop: 'sensor', size: 1.3, source: true },
      { id: 'junction', name: '', detail: '', prop: 'valve', size: .62 },
      { id: 'mqtt', name: 'Mosquitto', detail: 'MQTT broker', prop: 'gate', size: 1.55 },
      { id: 'writer', name: 'Database writer', detail: 'Python service', prop: 'writer', size: 1.35 },
      { id: 'timescale', name: 'TimescaleDB', detail: 'experiment history', prop: 'stack', size: 1.5 },
      { id: 'grafana', name: 'Grafana', detail: 'dashboards', prop: 'screen', size: 1.7, final: true },
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
};
