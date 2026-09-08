# Hanging mushroom bag illustration prompts

Created with the built-in image generation tool on 2026-09-05.

These are conceptual illustrations, not experiment photographs or observed growth records. The two v1 PNGs are 1024 x 1536 RGB images with white backgrounds. The generator did not emit true alpha transparency, including after a dedicated background-extraction request. Background removal is still required before using them as transparent scene layers. The composition and hanging anchor are similar, but generation edits are not guaranteed to preserve exact pixel alignment.

Style references: `../../design_reference.png` and `../../pvc_structure_4.png`.

## Base concept

Use case: stylized-concept.
Asset type: one standalone transparent PNG sprite for a layered 2.5D mushroom-tent website illustration.
Input images: Image 1 is the user's overall room/tent DESIGN REFERENCE ONLY. Image 2 is their existing PVC-frame asset, used ONLY to match perspective, soft shaded rendering, and visual simplicity. Do not recreate either reference scene or include the PVC frame.
Primary request: Create ONE vertically hanging oyster-mushroom cultivation bag WITHOUT any mushrooms, ready to composite hanging from one of the reference frame's horizontal rails.
Subject: a long rounded cylindrical clear polyethylene bag filled tightly with short chopped golden-brown pasteurized straw, with subtle cream-white mycelium patches among the straw. Gathered plastic neck tied securely with a simple short ivory cord; the cord rises into a small hanging loop. Bag is suspended vertically by this tie. Rounded softly compressed bottom, modest folds and clear plastic highlights, a few tiny ventilation slits. The bag is filled with straw, not empty. No mushroom fruit bodies or pins.
Style: match the supplied assets' gently shaded 2.5D product illustration, three-quarter view from slightly above, restrained material texture, clean readable silhouette, soft diffuse upper-left light, neutral warm straw and ivory highlights. Not a photoreal photograph, not a flat icon or cute cartoon.
Composition: portrait 1024 x 1536 canvas if available, real transparent alpha background. One bag centered; suspension loop at horizontal center near y=150; gathered neck around y=370; bag body roughly x=330..695 and y=440..1380. Keep substantial transparent space on left and right for oyster mushroom clusters to be added in a matching future variant. Entire cord, neck and bag visible with clear margins. No pipe or hook hardware, no floor shadow, no backdrop, no drop shadow outside subject.
Constraints: one object only; no text, labels, logos, borders, measurement graphics, diagram arrows, scenery, ground plane, or additional hardware. Background must be genuine transparency, not a painted checkerboard. This is a conceptual educational illustration, not a purported experiment photograph.

## Background correction attempt

Use case: background-extraction.
Edit target: the attached hanging straw cultivation bag.
Remove the entire painted checkerboard background. Return a clean isolated cutout with a genuinely TRANSPARENT ALPHA CHANNEL in the PNG; empty pixels outside the subject must have alpha zero. Do not draw or render a checkerboard, white background, grey background, backdrop, floor or shadow.
Preserve the bag, straw, plastic folds, cord, suspension loop, dimensions, position, perspective and lighting exactly. Keep 1024 x 1536 canvas. Do not crop or move the subject. No mushrooms. No text. The background in the input is mistakenly painted into the pixels; eliminate it completely. Preserve translucent plastic at the subject's edges and holes within the cord loop with real alpha.

## Fruiting variant

Use case: precise-object-edit.
Asset type: matching fruiting-state illustration for a layered 2.5D mushroom-tent scene.
Edit target: the attached hanging straw cultivation bag. Create its WITH OYSTER MUSHROOMS version.
Change only: add three restrained clusters of grey-beige oyster mushrooms emerging naturally through small slits in the bag's sides. A medium cluster on upper right side of the straw-filled body, a medium cluster around middle left, a smaller cluster lower right. Recognizable overlapping fan-shaped oyster caps, short lateral stems, cream gills visible underneath some caps. Use the same soft shaded illustrative rendering as the bag, with a slightly elevated three-quarter view and diffuse upper-left lighting. Avoid round button-mushroom shapes and long upright stalks. Keep the bag dominant, clusters compact and believable, not giant.
Invariants: retain precisely the same portrait 1024 x 1536 canvas, top-center suspension loop and cord, gathered neck, underlying bag shape, straw, position, dimensions, base height, color and lighting. Do not crop, move, stretch or resize the bag. Preserve transparent side margins for the clusters. No PVC pipe or surrounding tent, no ground, no drop shadow, no labels, logos or text.
Background: request genuine transparent alpha outside the full bag-and-mushrooms silhouette including the hanging loop interior; do not paint a checkerboard background. If true alpha cannot be emitted, use completely uniform pure white (#FFFFFF) everywhere outside the silhouette, with no checkerboard, texture, gradient or shadow.
This is a conceptual cultivation illustration, not documentary experiment photography.

## Matching version without mushrooms

Use case: precise-object-edit.
Edit target: the attached hanging straw bag with three oyster mushroom clusters.
Create its matching WITHOUT-MUSHROOMS variant. Remove all three mushroom clusters and their external fluffy growth, reconstruct the clear plastic and straw behind them naturally.
Preserve everything else: identical 1024 x 1536 portrait canvas, exact bag silhouette, suspension loop and cord, gathered neck, bag location and scale, base height, all visible straw and plastic details outside the edited areas, soft upper-left lighting, rendering style and perspective.
No mushrooms, pins, text, labels, extra objects, shadows or surroundings.
Use the same clean pure-white background as the input; no checkerboard pattern. This file is a concept render for subsequent transparent cutout preparation.

