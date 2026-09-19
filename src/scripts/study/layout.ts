// Fixed positions and connection endpoints in the authored 3D illustration.
// These coordinates are not experiment data or an electrical simulation.
export type Point = [number, number, number];
export const positions = {
  bag: [.57, 2.60, -.12], bag2: [.57, 1.19, -.12],
  frame: [-.30, 3.24, .45], cover: [1.40, 2.65, .45],
  cooler: [-1.03, 1.63, -1.58],
  fan: [1.44, .58, -.10], vent: [-.335, .60, -.12],
  humidity: [2.42, .14, -.12], duct: [1.86, 2.42, -.13],
  light: [.55, 4.10, -.12], camera: [-.39, 3.36, .02], camera2: [-.39, 1.95, .02],
  sensor: [-.30, 2.22, -.62], sht: [-.30, 2.66, -.62],
  pi: [-2.30, 1.33, -.20], ai: [-2.29, 1.555, -.26],
  mosfets: [-1.98, 1.33, .48], 'mosfet-led': [-1.20, 1.33, .48],
  ups: [-2.80, .525, .05], ssd: [-2.40, 1.326, .48],
  table: [-2.41, 1.26, .02], monitor: [-3.42, 1.295, -.37],
  keyboard: [-3.40, 1.311, .37], mouse: [-2.77, 1.308, .45],
  breadboard: [-1.57, 1.3225, -.05], cobbler: [-1.57, 1.37, -.05],
  'wago-red': [-1.80, 1.327, -.52], 'wago-black': [-1.60, 1.327, -.52],
  'wago-yellow': [-1.40, 1.327, -.52], 'wago-green': [-1.20, 1.327, -.52],
  'power-strip': [-1.25, .19, 1.06], adapter12: [-1.47, .31, 1.06],
  adapter24: [-1.00, .31, 1.06], 'pi-power': [-2.78, .67, -.225],
} satisfies Record<string, Point>;

export type ItemId = keyof typeof positions;
export const wireColors = { red: '#c34e3b', black: '#303a37', yellow: '#d3b44d', green: '#5f9863' };
export type WireColor = keyof typeof wireColors;
export const sensorColors: WireColor[] = ['red', 'black', 'yellow', 'green'];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Board top is the rear edge (negative Z), left is negative X. Both modules use
// the user's corrected layout: load on the left, supply on the right.
export type Terminal = 'load-black' | 'load-red' | 'supply-black' | 'supply-red' | 'breadboard-red' | 'breadboard-black';
export const terminalOffsets: Record<Terminal, Point> = {
  'load-black': [-.051, .069, -.119], 'load-red': [-.051, .069, -.058],
  'supply-black': [.051, .069, -.119], 'supply-red': [.051, .069, -.058],
  'breadboard-red': [-.051, .069, .137], 'breadboard-black': [.051, .069, .137],
};
export const terminalPoint = (id: 'mosfets' | 'mosfet-led', terminal: Terminal): Point => add(positions[id], terminalOffsets[terminal]);

// Authored breakout sockets, not a claimed electrical GPIO pin assignment.
export const cobblerSockets = {
  red: [-.05, .031, -.05], black: [.004, .031, -.05],
  yellow: [.058, .031, -.05], green: [.112, .031, -.05],
  'fan-red': [-.068, .031, .05], 'fan-black': [-.014, .031, .05],
  'led-red': [.076, .031, .05], 'led-black': [.130, .031, .05],
} satisfies Record<string, Point>;
export const cobblerPoint = (socket: keyof typeof cobblerSockets): Point => add(positions.cobbler, cobblerSockets[socket]);
export const cobblerRibbonPoint = (): Point => add(positions.cobbler, [-.19, .053, 0]);
export const stripPlug: Point = [-2.93, .44, -.225];
