# Myko character workshop

A standalone development surface for the canonical procedural Canvas renderer in
`src/characters/myko.js`. This is a character rig, not a film or a website mascot replacement.

## Build, inspect, validate

From the project root, using the project's Node version and installed dependencies:

```sh
node tools/myko-lab/build.cjs
node tools/myko-lab/check.cjs
node tools/myko-lab/snap.cjs
python3 -m http.server 4331 --bind 0.0.0.0 --directory exports/myko-rig
```

Open `http://localhost:4331/myko-character-lab.html`. The generated HTML also opens directly from disk.
`CHROMIUM=/path/to/chromium` overrides the default `/usr/bin/chromium` for checks and screenshots.
There are no remote resources, image assets, fonts, or runtime dependencies in the generated page.
The build inlines the canonical source, fixtures, and controls. Reference images never enter the build.

The workshop offers a large character preview; five view presets; four pose presets;
eight expressions; playback and single-pose stepping; 8/12fps held poses in a 24fps display;
scrubbing; joint controls; optional registration shifts; and joint guides.
Turnaround, pose, expression, and scale sheets each call the same renderer. **Save this sheet**
exports the current procedural Canvas. Screenshots and the generated HTML are reproducible
build artifacts in the ignored `exports/myko-rig/` folder.

`check.cjs` checks source dependencies, cold/warm/reverse/fresh-context determinism,
8/12fps frame holds, 160 combinations of views/expressions/poses, finite drawing arguments,
transform balance, caller state and clip preservation, rejected invalid inputs,
pose override isolation, expression/yaw differences, local joint independence,
frame cost, controls and narrow-screen overflow. The report is `exports/myko-rig/checks.json`.
The test clock may use performance timing; the character renderer never does.

## Renderer API

The file is a dependency-free classic script. It exposes `globalThis.MykoCharacter`.
Load it once before shots (or import it for its side effect in an ESM build).
All geometry is authored in normalized character space; one unit is the bare helmet-to-sole
height. Thus `scale: 500` draws a roughly 500px body plus the mushroom crown.
`x,y` position the ground anchor, not the center of the image. Leave approximately
`1.25 * scale` above the anchor for the complete crown.

```js
const { MykoRig, getPose } = globalThis.MykoCharacter;
const myko = new MykoRig({ x: 540, y: 1500, scale: 700, facing: 'left' });

// In a procedural-film scene's draw(ctx, t, info):
myko.pose({
  ...getPose('reaching', t, { fps: 8 }),
  eyeExpression: 'curious',
  eyeLookX: -0.5,
  eyeLookY: -0.2,
});
myko.draw(ctx, { time: t, fps: 8, stopMotion: true });
```

For shots that are rendered out of order, always assign the complete authored pose for the
requested timestamp, or use `drawMyko(ctx, options)` directly. `pose(patch)` deliberately merges
patches; it is not an animation-history integrator. Per-draw overrides do not mutate the rig.
`reset(patch)` starts from canonical defaults.

### Controls

| Inputs | Units / behavior |
| --- | --- |
| `x`, `y`, `scale`, `rotation` | Logical pixels, body height in pixels, global radians. Positive scale required. |
| `bodyLean`, `bodyOffsetY` | Radians around the pelvis; optional normalized vertical root displacement. |
| `headRotation`, `headTilt` | Projected yaw in `[-1,1]`; roll at the neck in radians, clamped to ±0.6. |
| `leftShoulder`, `leftElbow`, `leftWrist` | Radians, hierarchical torso → shoulder → elbow → wrist. |
| `rightShoulder`, `rightElbow`, `rightWrist` | Same on the other arm. |
| `leftHip`, `leftKnee`, `leftFoot` | Radians, hierarchical pelvis → hip → knee → ankle/boot. |
| `rightHip`, `rightKnee`, `rightFoot` | Same on the other leg. |
| `eyeExpression` | `neutral`, `curious`, `happy`, `concerned`, `surprised`, `sleepy`, `focused`, `sad`. |
| `eyeLookX`, `eyeLookY` | Local gaze in `[-1,1]`, clipped to the visor. |
| `breathing`, `myceliumGlow` | Amounts in `[0,1]`; breathing samples supplied `time`. |
| `mushroomSway` | Signed amount `[-1,1]`; the complete stem/cap pivots at its attachment. |
| `facing` | `front`, `left`, `right`, `side-left`, `side-right`. These are projected drawing presets. |
| `time`, `fps`, `stopMotion` | Explicit seconds; held-pose rate (usually 8 or 12); quantize secondary animation. |
| `animate` | Enables restrained held head, breathing, and crown motion. Default false. |
| `imperfections`, `seed` | Optional deterministic pixel registration, tiny head/crown variance. Default off. |
| `debug` | Draws local joint origins and bone directions. |

In the canonical three-quarter-left view, anatomical left is the nearer arm/leg on screen right.
Mirrored presets retain the same named controls and attachment identities.
Pose presets are `neutral`, `walking` (in place), `reaching`, and `crouching`.
The renderer validates finite numeric inputs before touching the context. Unknown views or
expressions are rejected. Extreme angles can self-intersect: this is a forward-kinematic
illustration, not an inverse-kinematics solver or collision system.

### Held poses

```js
const { holdPose, stepPose, easeStopMotion, drawMyko } = MykoCharacter;
const tHeld = holdPose(t, 8); // 0, 0, 0, .125... at a 24fps display rate
const pose = stepPose([
  { time: 0, pose: { leftShoulder: -0.12, eyeExpression: 'neutral' } },
  { time: 1, pose: { leftShoulder: 1.1, eyeExpression: 'curious' } },
], t, { fps: 8 });
drawMyko(ctx, { x: 540, y: 1500, scale: 700, ...pose, time: tHeld });
```

`stepPose` holds complete keyframe pose objects by default. With `interpolate:true`, shared numeric
properties ease between adjacent poses at the held clock; categorical properties switch at the
next keyframe. `easeStopMotion(t, duration, fps)` provides a held smoothstep progress value.
Externally calculated joint angles must use `holdPose`, `stepPose`, or `getPose` themselves;
the renderer cannot retroactively quantize arbitrary angle values computed by a caller.

## Architecture and future film integration

Painter's order is fixed. A pelvis root owns both articulated legs and the upper-body subtree.
The upper body owns the attached backpack, rear arm, belly plate and its mechanisms, near arm,
and neck/head. Each limb owns its joints, armor, cuff/boot, fungi, moss and weathering.
Head owns shell → visor → clipped eyes → fixed vegetation/crown → shell filaments.
Occlusion-sensitive details are drawn in their parent part's pass, not a floating global overlay.
Palette values are exported and frozen. Geometry and texture caches contain only code-generated
paths keyed by geometry/seed. They contain no image data and no mutable animation state.

`test-scene.js` optionally registers `myko-character-sheet` when a `FILM.scene` registry already exists.
For a future film, include this repository's canonical renderer once in the foundation build's
source list after core/lib and before scenes. Shots should call its API; do not copy the file
into each shot or copy its drawing functions. No change to the previous film was made here.
Canvas transforms, styles and clip are preserved by save/restore. As usual with Canvas 2D,
the caller should begin a fresh path after another renderer: save/restore does not preserve
the mutable current path. Render without a caller shadow/filter if the canonical finish is desired.

## Visual review

See `docs/myko-character-spec.md` for the reference decomposition and
`docs/myko-rig-review.md` for inspected iterations and remaining differences.
Screenshots are evidence of a procedural interpretation, not pixel-perfect reproduction.
