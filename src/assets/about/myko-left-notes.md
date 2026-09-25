# Left-angle Myko

`myko-left-empty.png` was prepared using the built-in image-generation tool from the supplied `mascot_myko_left.png` (edit target) and `reference_left_angle.png` (supporting reference). The model version is not selectable or verified. Original uploads remain untouched.

Prompt: Change only the two amber eyes and their immediate glow in the full-body left-facing Myko image, reconstructing empty dark glass beneath them. Preserve the entire character, canvas, camera, alpha, textures, cyan face dot and upper visor reflection. Do not zoom, recenter, add scenery, labels or split into parts. The removed eyes are approximately centered at (403,482) and (554,455) on the 1254px square image.

Eye artwork is drawn in SVG to fit the asymmetric visor perspective. Neutral, curious, gentle happy, melancholic and sleepy use amber; surprised wonder uses icy cyan (#b4f7ff) with cyan glow. Expression symbols follow the reference sheet.

Timing: neutral tracks the pointer; 2 seconds without activity makes Myko melancholic, 4 seconds total makes him sleepy. Activity from melancholy triggers a 2-second curious reaction; activity from sleep triggers a 2-second surprise. Gaze remains frozen during either reaction, even if more movement arrives. Afterwards neutral tracking resumes and the idle countdown restarts. Clicking Myko gives a 2-second happy reaction. Timing pauses offscreen or in a hidden tab; reduced motion disables physical movement but retains expression changes.

## Interactions

Clicks (and Enter on Myko) say the next line of a running sequence; after the opening hello the other lines loop. Five clicks inside 2.5 seconds make him dizzy (spinning spiral eyes), then he recovers with "Okay, okay…"; he ignores clicks for both. Lines are announced through a polite live region.
Tap spots are ellipses in the 1254px image space. Tapping a mushroom cap releases cyan spores from its gills and Myko's eyes follow them up; tapping the visor makes him squint (`><`); tapping the backpack gets field kit lines; anywhere else continues the running sequence. Reduced motion keeps the lines and faces but skips the spores and gaze.
Sneak-up game: while he sleeps, pointer movement slower than 120px a second (the first move after a pause is timed as one short frame) keeps him asleep. A creep that starts off the visor, covers 30px and ends on it makes him open one eye: "…you're sneaky." Any normal movement, tap or key still wakes him with the surprised face.
Dreams: 1.4 seconds into sleep a thought cloud appears above his cap and cycles ink doodles (mushroom, Raspberry Pi, peacock) every 3.4 seconds, continuing from the last doodle on the next nap. Waking clears it. With reduced motion the doodles swap without drifting.
Cross-eyed: while he is awake and neutral, a mouse or pen resting on the visor ellipse pulls both eyes toward his nose ("That's… very close."). Touch never hovers, so it skips this. The idle countdown still runs, so he turns melancholic and sleepy as usual.
Glances: elements marked `data-myko-glance` (the profile photo and each journey stop in `about.astro`) make Myko look at them and say their line with `data-myko-mood` when hovered or tapped, at most once per element every 20 seconds. A glance can replace another glance but never interrupts a wake-up, a click line or a nap.

## Contact bubble

"Contact me" is a one-line speech bubble in the same organic oval as the dialog's status bubble, with a tail (a skewed, rotated square sharing the bubble's fill and ring) pointing down at Myko's visor. It pops out from the tail once on load, lifts on hover or keyboard focus, and presses in when clicked. Hovering or focusing it is a glance spot: Myko looks at it and says "I'll carry your note to Omar." Reduced motion drops the pop, lift and gaze but keeps the line.
