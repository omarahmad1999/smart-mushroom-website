# Myko rig: rendered review

## Scope

Character development only. The reference PNGs were inspected, never loaded by the
renderer or included in its standalone output. All drawing uses Canvas paths, gradients,
clipping, ellipses, and deterministic code-generated surface marks. The previous film and
website routes were not edited. No new narrative film or soundtrack was produced.

## Evidence

Run `node tools/myko-lab/snap.cjs` to reproduce the inspected images:

| File in `exports/myko-rig/` | What it verifies |
| --- | --- |
| `hero.png` | Large three-quarter view: silhouette, face, palette, material detail and attachments. |
| `views.png` | Front-ish, mirrored three-quarter views, projected left/right profiles. |
| `poses.png` | Neutral, walking, reaching, crouching with shared geometry. |
| `expressions.png` | Eight emotions on unchanged body/crown geometry. |
| `scales.png` | 600, 300 and 120px mechanical body heights. |
| `workshop.png` | Interactive preview and control layout. |
| `checks.json` | Reproducibility, drawing, state, performance and UI checks. |

The scale-study page is tall enough to leave the complete 600px character below its header.
Screenshots are generated artifacts and are ignored in Git. The source and specification
are committed; screenshots can be regenerated without any reference media.

## Review and corrections

The initial rendered pass was inspected at large size and on all four sheets. Corrections
were made from rendered evidence, including a separate visual critic review:

- Broadened leg armor and allowed the thigh plates to overlap the knee mechanisms.
- Thickened mushroom stems and exposed radial cyan gills below the cap rims.
- Replaced flat moss patches with shaded irregular mounds and smaller leaf flecks.
- Softened excessive visible cracking inside the visor.
- Shifted the head, near shoulder, near hip and backpack relative to the torso to preserve
  the reference's asymmetric three-quarter stance.
- Changed the crown cap from a regular conical form to a broader dome with uneven edges,
  shorter wrinkles and peach mottling.
- Fixed a detached backpack in profile views by bringing it against the body and adding
  its padded back plate and shoulder yoke. Both profile screenshots were re-inspected.
- Compressed the profile torso and occluded far limbs to give the side view a consistent projection.
- Changed reaching from a fist folded across the chest to an articulated far arm extending
  clearly beyond the front silhouette. The connected wrist/elbow/shoulder was re-inspected.
- Increased curious asymmetry and surprised eye area; lowered and narrowed the sad eyes.
- Selected the open-stride phase for the walking sheet rather than the projected crossing phase.
- Fixed the workshop reset button shadowing `form.reset`, then exercised the controls again.

In the 611px body-height hero, the helmet is approximately 295px wide and 230px tall
(`0.48H × 0.38H`), close to the reference estimate `0.47–0.50H × 0.36–0.40H`.
The crown, amber eyes, cream armor, bronze joints, moss, cyan veins and leather-colored
backpack remain recognizable at the smallest 120px body height; microscopic texture is
intentionally reduced there. All named poses reuse the same local shape and surface seeds.

## Remaining differences

This is a recognizable procedural illustration of Myko, not a pixel-perfect reproduction.

- The source has a richer painterly finish, stronger localized reflections, more irregular
  ceramic chips and heavier vegetation coverage. The procedural version remains cleaner
  and flatter, especially on the forearms, backpack and crown.
- Moss still forms more regular attachment bands than the sprawling reference growth.
- Visor contour, mushroom gills and small mechanical parts are controlled approximations.
- Mirrored and side views are authored 2D projections, not views of a complete 3D mesh.
  Hidden geometry is inferred. Head yaw is a bounded projected face turn; no free camera orbit.
- Walking is a reusable in-place gesture, not a solved ground-contact simulation. Extreme
  custom joint angles can intersect armor; there is no collision or inverse-kinematics solver.

These limits should guide future shot composition. The rig is suitable for planning and
articulating character shots; this review does not claim the original painted surface has
been matched exactly.

## Validation

`node tools/myko-lab/check.cjs` performs 33 checks, including exact pixel comparisons in
cold/warm/reversed/new-context renders, held frames at 8/12fps, all 160 combinations of
five views × eight expressions × four poses, state/clip preservation, finite Canvas arguments,
invalid inputs, separate expressions and yaw values, joint independence, and working controls.
No runtime media or network requests are made. The generated report records actual render timings.

Project validation: `npm run check` and `npm run build`. Existing hints in the older film
and the website's existing large-chunk build warning are unrelated to this standalone rig.
