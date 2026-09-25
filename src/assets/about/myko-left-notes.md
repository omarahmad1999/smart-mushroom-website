# Left-angle Myko

`myko-left-empty.png` was prepared using the built-in image-generation tool from the supplied `mascot_myko_left.png` (edit target) and `reference_left_angle.png` (supporting reference). The model version is not selectable or verified. Original uploads remain untouched.

Prompt: Change only the two amber eyes and their immediate glow in the full-body left-facing Myko image, reconstructing empty dark glass beneath them. Preserve the entire character, canvas, camera, alpha, textures, cyan face dot and upper visor reflection. Do not zoom, recenter, add scenery, labels or split into parts. The removed eyes are approximately centered at (403,482) and (554,455) on the 1254px square image.

Eye artwork is drawn in SVG to fit the asymmetric visor perspective. Neutral, curious, gentle happy, melancholic and sleepy use amber; surprised wonder uses icy cyan (#b4f7ff) with cyan glow. Expression symbols follow the reference sheet.

Timing: neutral tracks the pointer; 2 seconds without activity makes Myko melancholic, 4 seconds total makes him sleepy. Activity from melancholy triggers a 2-second curious reaction; activity from sleep triggers a 2-second surprise. Gaze remains frozen during either reaction, even if more movement arrives. Afterwards neutral tracking resumes and the idle countdown restarts. Clicking Myko gives a 2-second happy reaction. Timing pauses offscreen or in a hidden tab; reduced motion disables physical movement but retains expression changes.

## Interactions

Clicks (and Enter on Myko) say the next line of a running sequence; after the opening hello the other lines loop. Five clicks inside 2.5 seconds make him dizzy (spinning spiral eyes), then he recovers with "Okay, okay…"; he ignores clicks for both. Lines are announced through a polite live region.
Tap spots are ellipses in the 1254px image space. Tapping a mushroom cap releases cyan spores from its gills and Myko's eyes follow them up; tapping the visor makes him squint (`><`); tapping the backpack gets field kit lines; anywhere else continues the running sequence. Reduced motion keeps the lines and faces but skips the spores and gaze.
