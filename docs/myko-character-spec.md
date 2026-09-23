# Myko: canonical procedural character specification

This is a character-development specification, not a film storyboard. It describes one reusable Canvas 2D character. No narrative film, scene sequence, soundtrack, or replacement website mascot is part of this task.

## Reference and method

Visual development was inspected from `media_for_astro_website/mascot_myko_left.png` (1254 × 1254) and `media_for_astro_website/reference_left_angle.png` (1448 × 1086). The first supplies the detailed three-quarter silhouette; the second supplies alternate views, expressions, material close-ups, and six palette swatches. These are local analysis inputs only: the character renderer and standalone test player must never load, embed, encode, rasterize, or ship them.

The proportions below are estimates from visible projected bounds, not a claim that a single generated reference provides an exact orthographic model. Small details differ between its views. Preserve the recurring identity, and choose one stable construction instead of making those inconsistencies animate.

The procedural-film foundation and its `reference/scene-anatomy.md`, along with `examples/butterfly-life/src/scenes/01-hero-on-milkweed.js`, establish the useful conventions: deterministic seeded geometry; separate geometry, palette, timing, and drawing helpers; explicit painter's-order layers; balanced Canvas transforms; and stateless rendering at arbitrary times. Its conventional ink-and-paper film treatment does not override this character reference. Myko needs rounded material shading and irregular surface detail, not the flatter design from the earlier film.

## Four feature classes

| Class | Meaning | Examples |
| --- | --- | --- |
| **IMMUTABLE CHARACTER IDENTITY** | Cannot change between shots or expressions. | Oversized helmet, glossy dark visor, two amber eyes, cream segmented armor, stocky limbs, bronze joints, mushroom crown, moss, cyan branching seams, backpack. |
| **POSE-DEPENDENT GEOMETRY** | Changes only through the rig hierarchy and view projection. | Joint angles, foreshortening, overlap, head turn, foot direction, perspective compression. |
| **EXPRESSION-DEPENDENT GEOMETRY** | Changes within the fixed visor and optional pose accents. | Eye curvature, eyelid opening, relative eye height, gaze, head inclination. |
| **OPTIONAL DETAIL** | May be reduced at small scale without changing the silhouette. | Micro-scratches, individual moss leaves, cap stippling, tiny rivets, restrained registration jitter. |

## Normalized space and scale

Use the planted character's ground anchor as `(0, 0)`. One unit `H` is the height from bare helmet top to sole, excluding mushrooms. `scale` is the size of `H` in Canvas logical pixels; `x` and `y` place the ground anchor. Angles are radians. Therefore, a standing character with `scale: 500` has an approximately 500 px mechanical body and a 615 px total crowned silhouette.

Approximate neutral three-quarter guide geometry:

| Landmark / bound | Normalized measurement | Interpretation |
| --- | --- | --- |
| Bare helmet top | `y ≈ -1.00H` | Moss may rise above this. |
| Crown cap top | `y ≈ -1.23H` | Dominant mushroom defines overall top. |
| Helmet projected bounds | `0.47–0.50H` wide × `0.36–0.40H` high | Includes pale side dome, not only face opening. |
| Helmet center | `y ≈ -0.81H` | Above and slightly forward of torso. |
| Visor projected bounds | `0.27–0.30H` wide × `0.25–0.28H` high | Three-quarter view; wider when front facing. |
| Torso | `0.28–0.33H` wide × `0.28–0.31H` high | From `y ≈ -0.62H` to `-0.32H`. |
| Shoulder centers | `y ≈ -0.56H` | Near shoulder projects outward and slightly lower. |
| Hip axis | `y ≈ -0.28H` | Exposed dark rotary joints below chest. |
| Knee axis | `y ≈ -0.13H` | Short visible leg construction. |
| Soles | `y = 0` | Neutral planted pose; far sole may project slightly higher. |
| Body including arms | `0.62–0.67H` wide | No long thin limbs. |
| Total crown-to-sole aspect | width / height `≈ 0.58–0.61` | Includes backpack protrusion. |

The torso is not a human ribcage on long thighs. The helmet occupies about 37–40% of bare mechanical height, and the arms nearly reach the upper shins. Head-to-rest-of-body height is approximately `0.38 : 0.62`.

## 1. Canonical proportions — IMMUTABLE CHARACTER IDENTITY

The silhouette is compact, heavy, friendly, and slightly top-heavy. The head is wider than the chest; the arms add much of the total width. Short legs and oversized planted boots balance the tall mushroom crown. Front and side views preserve these lengths and masses, with perspective changing only their projected width and overlap.

## 2. Silhouette — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Read the outer contour as crown mushroom, smaller asymmetric caps, rounded helmet, squat armored shoulders, large forearms, short shins, and broad toes. A rear brown backpack adds an uneven, mostly rectangular mass. Leave small gaps at the elbows and between boots so limbs remain readable. Facing left places the face forward to screen left and the visible backpack to screen right; facing right mirrors the projection while retaining named anatomical joints.

## 3. Body/head ratio — IMMUTABLE CHARACTER IDENTITY

Use the measurements above. Avoid either a tiny helmet on a human body or a giant floating face on an abbreviated torso. The lower rim nearly meets the moss-covered shoulder collar. There is a short dark mechanical neck recess, not a long exposed neck.

## 4. Head geometry — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Construct a rounded, slightly oblate helmet with a thick cream front rim, shaded spherical side shell, and darker underside. In the left three-quarter view, the dark face is left-shifted within the larger shell; the viewer sees more pale shell on its right side. The outline is not a perfect flat disk. Include a top panel junction, subtle curved shell seams, and a rim edge with thickness. Moss grows over the rear and top; it must not substitute for the shell itself. Rotate the complete head subtree at its neck attachment, including face, vegetation, fungi, and cyan paths.

## 5. Visor geometry — IMMUTABLE CHARACTER IDENTITY

The face opening is a rounded dark oval/squircle, bowed outward like smoked glass. It has a gently domed top and subtly flattened lower edge. Three-quarter perspective narrows its far side. Draw a dark warm-brown recess, a thin near-black gasket, then glossy convex glass with muted brown reflection shapes. The cream surround has visible thickness and broad highlights. Clip every expression and gaze displacement to the visor's interior; eyes never cross its boundary. Do not turn the face into a black rectangular monitor.

## 6. Eye positions and sizes — IMMUTABLE CHARACTER IDENTITY / EXPRESSION-DEPENDENT GEOMETRY

Two glowing warm amber vertical ovals sit in the lower-middle face. The near eye is larger and wider in the three-quarter view; the far eye is compressed. In the detailed hero, projected eye height is roughly `0.07–0.10H`, and their separation is around `0.15H`. Place their common baseline below visor center. The small cyan status dot lies centrally below and between them. A brighter cream eye core, orange edge, and soft amber spill create emission without flooding the visor. White shine above the near eye is a glass reflection, not a third eye.

Gaze is local to the face plane and bounded by the inner visor. Expression changes alter eye shapes and eyelid curves, never helmet size, mushroom count, or eye palette. Side projection can occlude the far eye instead of squeezing both eyes into a tiny patch.

## 7. Torso geometry — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Use a rounded barrel/pear-like cream chest with a somewhat narrower top and a bulbous lower plate. A curved horizontal upper seam, vertical/diagonal panel divisions, and weathering describe its volume. Add the narrow horizontal amber chest indicator near the top front, with a thin metallic inset. A dark oval emblem inset on the lower front carries a restrained sprout mark. Bronze side plates and a dark underside transition to hips. The chest must remain cream, not a flat brown torso with decorative cream circles.

## 8. Shoulder and arm construction — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Each shoulder starts with a dark bronze circular mechanical socket. A large cream curved upper-arm sleeve covers its outer portion, with a dark open lower rim. A short exposed circular elbow joins a substantial cream forearm shell; the forearm is not a single stick. The near arm is larger by projection. Upper arm length is about `0.16–0.19H`, forearm about `0.16–0.19H`, excluding hand. The hierarchy is torso → shoulder angle → elbow angle → wrist angle → hand. Moving the shoulder necessarily moves its elbow, wrist, attached moss, and mushrooms. Forearm mushrooms rotate with the forearm.

## 9. Hands — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Small heavy mechanical hands sit within dark cuff rings. They have two or three readable rounded digit blocks plus a thumb, bronze knuckles, and seam lines. In neutral they form relaxed mitten-like fists. Reaching may spread or rotate the fingers slightly, but never turns the hands into flesh or flat circles. Finger detail may simplify at small size; cuff placement and grip direction may not.

## 10. Hips and legs — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Two circular hip mechanisms are visible beneath the chest. Short legs carry cream thigh/shin armor over dark rotary joints. A broad dark knee or ankle hinge contrasts with the pale plate. The hierarchy is pelvis → hip angle → knee angle → foot angle → boot. Flex knees visibly when crouching; do not merely lower the body and leave disconnected shins. Moss joins seams around thighs and knees without erasing joints.

## 11. Feet — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Boots are oversized low cream shells with bronze toe caps, dark sole thickness, and moss along seams. The toe projects toward the facing direction and has a low rounded wedge shape; a vertical oval reads as a hoof and is incorrect. Keep a clear planted sole in standing poses. Far and near boots are offset in perspective, not stacked on the same x coordinate. Target boot length roughly `0.16–0.20H` and height `0.09–0.12H`.

## 12. Backpack — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

The brown utility backpack is rigid but rounded at the edges. It has a tall main compartment, upper flap, raised side pockets, metal rivets, leather-like straps, two buckles, and a lower hanging loop. It sits behind the shoulders and torso and projects on the rear side in three-quarter view. A thin outline-only rectangle is insufficient; shade its depth and pockets. In front view it is largely occluded. Side/rear visibility is pose/view-dependent. The existing dormant-ball asset omits the backpack, but that is a different state; this task's canonical standing Myko retains it.

## 13. Mushroom placement — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

Use fixed attachment positions and a repeatable dominant/secondary hierarchy, not a fresh scatter per frame. A large peach umbrella grows near the top center/rear of the helmet, rising about `0.20–0.23H` above the shell. Two to four smaller caps flank it around the crown, with tiny pins along the moss ridge. Shoulder-collar caps, a pair on the near forearm, one or two near the far forearm, and a small near-shin group repeat in the reference. Exact tiny pin count can simplify, but crown dominance and attachment regions cannot move between poses.

Caps have curved peach domes, pale wavy rims, mottled warm highlights, and radial gills underneath in icy pale cyan. Stems are cream with peach marks and faint cyan shading. The main crown cap is an umbrella, not a flat disk or button. Curving stems and unequal cap sizes make the growth organic. Sway is a small angle about each stem base, not sliding the cap independently off its stalk.

## 14. Moss and vegetation — IMMUTABLE CHARACTER IDENTITY / OPTIONAL DETAIL

Olive and forest-brown moss clumps grow across the head crown/rear, shoulder collar, armor seams, forearms, leg edges, and boot backs. Use irregular overlapping mounds, with ochre tips, darker crevices, and a few tiny leaves. Avoid even green polka dots or large uniform green blobs. Cream armor stays clearly visible. Patch locations are immutable; individual leaf/dot detail is optional. Moss casts small contact shadows on shell surfaces so it reads as growth resting on them.

## 15. Glowing cyan mycelium — IMMUTABLE CHARACTER IDENTITY / OPTIONAL DETAIL

Thin branching cyan fissures run along the exposed helmet side/rear, neck/shoulder junction, and selected arm/body seams. Draw an irregular main filament with tapered daughter branches and small intersections. Bright near-white cyan cores sit inside a restrained turquoise halo. These are fine organic veins, not a single thick neon stripe, evenly spaced lightning bolts, or body-wide circuitry. Their route is anchored to the relevant body part and remains deterministic. `myceliumGlow` changes emission strength only. Fine tertiary branches may drop out at small scale.

## 16. Panel seams and mechanical details — IMMUTABLE CHARACTER IDENTITY / OPTIONAL DETAIL

Keep the main cream armor panels, dark shoulder/hip/elbow rings, chest slit, chest emblem, visor gasket, backpack buckles, and boot toe caps at all meaningful scales. Curved seams follow form; joints have concentric metal rings and off-center pins. Tiny screw heads, panel scuffs, notch marks, and hairline ceramic crazing are optional. Do not fill the whole character with arbitrary intersecting linework.

## 17. Named palette — IMMUTABLE CHARACTER IDENTITY

The first six values below were sampled at the centers of the six swatches in the reference sheet. Other colors are deliberate approximate material endpoints selected from the hero image; reference shading is not reducible to one flat fill.

| Token | Hex | Role |
| --- | --- | --- |
| `referenceDark` | `#473B34` | Reference dark warm gray / deep metal. |
| `referenceBronze` | `#8D6547` | Reference bronze / backpack leather. |
| `referenceMoss` | `#7F7142` | Reference olive moss midtone. |
| `referenceStone` | `#BCB1A5` | Reference cool gray-beige shell shade. |
| `referenceCream` | `#E6DACB` | Reference cream shell base. |
| `referenceCyan` | `#98E3EB` | Reference mycelium cyan. |
| `shellHighlight` | `#FFF0DA` | Broad upper-left shell highlight. |
| `shellWarm` | `#E7C9AC` | Warm ceramic midtone. |
| `shellShadow` | `#A78E74` | Underside / occluded shell. |
| `visorDeep` | `#211B18` | Gasket and darkest glass. |
| `visorWarm` | `#49362A` | Convex glass reflection. |
| `metalHighlight` | `#AA8465` | Bronze rim and joint pins. |
| `metalShadow` | `#332B25` | Joint recess. |
| `mossDeep` | `#3C4025` | Moss shadow. |
| `mossLight` | `#A7944A` | Moss tips / ochre flecks. |
| `capPeach` | `#EFAE7A` | Mushroom dome. |
| `capLight` | `#FFDFB8` | Cap ridges / upper light. |
| `capShadow` | `#B87549` | Cap rim and stipple. |
| `gillLight` | `#DDFCFA` | Pale blue illuminated underside. |
| `gillShade` | `#9BCFD0` | Radial gill separation. |
| `eyeCore` | `#FFF2C5` | Eye emitter center. |
| `eyeAmber` | `#FFB65D` | Eye / chest edge glow. |
| `myceliumCore` | `#D6FFFF` | Fine emissive filament. |
| `weathering` | `#AA7149` | Rusty dirt and shell flecks. |

Exact palette constants used by the renderer are its authoritative implementation values. Keep colors in one exported object so scenes cannot gradually redesign Myko through local hard-coded alternatives.

## 18. Texture treatment — OPTIONAL DETAIL with immutable material character

Cream ceramic has sparse irregular terracotta chips, fine crazing, soft tonal patches, and local grime along seams. Bronze has mottled oxidation and edge wear. Moss is a collection of clumps and leaf flecks. Caps have gentle lobed striations and peach mottling. Glass is predominantly smooth with a few fine hairline marks and broad reflections; do not fill it with high-contrast hatching. Texture uses stable component-specific seeds, local coordinates, and clipped drawing. It travels with its surface. Never regenerate its locations from frame time.

At small sizes, preserve broad shading and a few larger chips while dropping high-frequency marks. At close-up sizes, add detail without increasing outline thickness. No texture atlas, hidden bitmap canvas sprite, data URL, external image, or reference-derived mask is allowed: all marks must originate in drawing code.

## 19. Outline treatment — IMMUTABLE CHARACTER IDENTITY / OPTIONAL DETAIL

Warm brown contours are narrow and variable, with deeper lines at overlaps and joints. Use roughly `0.0015–0.003H` for main contours at a medium close-up, thinner for seams; avoid uniform black sticker outlines. Deliberate tiny contour irregularity can be seeded and held per pose, but the shell shape itself must not boil or change proportions. Highlights may interrupt a contour on the lit edge.

## 20. Highlights and shadows — IMMUTABLE CHARACTER IDENTITY / POSE-DEPENDENT GEOMETRY

The main light comes from upper front-left. Broad cream highlights round the shell and forearms. Shell undersides, backpack-to-body contacts, elbow recesses, and moss bases have warm contact shadows. Gradients should follow individual forms rather than placing a single global gradient over the silhouette. Glass gets a soft broad brown reflection plus a small warm highlight near the top; it is not just an opaque black hole. Amber eye/chest light and cyan veins provide restrained local emission. A soft ground contact ellipse can be supplied by the test scene; it is not part of the immutable character geometry.

## 21. Visually immutable identity: acceptance checklist

Even at a 140 px bare-body height, all of the following should remain legible:

- Oversized cream helmet with thick rim and dark convex face.
- Two warm amber eyes and a small cyan lower status point.
- Compact cream chest with narrow amber slit.
- Bronze circular joints, thick forearms, short legs, planted chunky boots.
- Dominant peach crown mushroom with smaller uneven companions.
- Olive moss patches and a few fine cyan branches.
- Brown backpack silhouette when the viewing angle exposes it.

Microtexture is allowed to disappear. The crown, head proportions, visor, eyes, chunky limbs, and three material families are not. A render that resembles a generic beige robot wearing a mushroom hat has not yet met the brief.

## Rig, layer, and animation contract

The canonical renderer lives in `src/characters/myko.js`. All views, poses, expressions, tests, and future film shots call it. Future scenes may set its pose and lighting parameters; they may not copy its drawing code or redefine its anatomy.

The root hierarchy contains a pelvis/body anchor, a torso, shoulders and their child elbows/wrists, hips and their child knees/feet, and a neck/head subtree. All local vegetation, mechanical detail, and texture inherit their parent component's transform. Facing changes the projected view and draw order, not the named anatomical identity of the joints. In the canonical three-quarter-left view, anatomical left is the nearer, screen-right side.

Painter's order is deterministic: rear backpack/fungi; rear limbs; torso; torso details; front limbs; head shell; visor; eyes; anchored moss; anchored mushrooms; local cyan glow; clipped weathering; form highlights. Components that must occlude correctly across views may move between front/rear passes without changing their geometry. Fungi on an arm must remain in that arm's local pass rather than floating in a screen-space overlay.

Expose position/scale/global rotation, body lean, head rotation/tilt, shoulder/elbow/wrist angles for both sides, hip/knee/foot angles for both sides, expression, local gaze, breathing, mushroom sway, mycelium emission, and facing. Position and orientation are inputs, never inferred from previously drawn frames.

### Expression vocabulary

| State | Eye construction | Optional pose accent |
| --- | --- | --- |
| `neutral` | Two calm upright warm ovals; perspective changes their width. | Balanced head. |
| `curious` | One eye slightly wider/higher; other mildly narrowed. | Small head tilt. |
| `happy` | Two upward smiling arcs with bright rounded ends. | Small lifted posture. |
| `concerned` | Upper lids angled gently inward with unequal opening. | Chin slightly lowered. |
| `surprised` | Larger rounder eyes, still bounded by visor. | Slight backward head lift. |
| `sleepy` | Mostly closed soft downward lid arcs. | Head lowered. |
| `focused` | Narrow firm openings and modest inward upper lid slope. | Forward lean. |
| `sad` | Low half-open eyes and sloping upper lids. | Quiet downward head tilt. |

Neither emotion nor gaze changes the palette, helmet silhouette, mushroom placement, or body proportions. The reference's emotion punctuation is presentation decoration, not an anatomical feature.

### Held animation

Film display is 24 fps; the character supports held drawings at 8 or 12 poses per second. Sample the entire input pose at `floor(t × poseFps) / poseFps` before drawing. Do not quantize each limb differently. Interpolation helpers may calculate a continuous pose internally, but only the held pose is rendered. Optional imperfections derive from `(seed, poseIndex)`: 1–2 logical px registration offsets at a large render, at most tiny head-angle and mushroom-angle changes, and a very small lighting variation. The same timestamp must render identically regardless of previous frames or render order. Default identity and texture have no stochastic temporal drift.

## Test-sheet requirements and limitations

Render front-ish, three-quarter left/right, and a best-effort side view; neutral, walking, reaching, and crouching poses; all eight expressions; and three sizes. Inspect both a character sheet and large close-ups. A small grid can hide missing visor material, mismatched eye perspective, and primitive limb construction. Measure crown/helmet/body bounds against this specification in screenshots, rather than claiming fidelity from code alone.

The available references do not provide exact orthographic turnarounds, rig topology, or hidden arm/leg details. A Canvas 2D renderer can provide carefully designed projected views and articulated poses; it does not have free arbitrary 3D camera orbit or physically correct self-occlusion for every extreme angle. Record remaining material/proportion/view differences after rendering, and keep those limitations explicit. No full film should be started as part of validating this rig.
