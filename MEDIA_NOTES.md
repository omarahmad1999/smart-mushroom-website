# Published media provenance

These notes describe the finite, editorial selection published with this website. They are documentation, not a public manifest, data-release protocol, or website data source.

## Supplied artwork

The original `media_for_astro_website/` images remain unchanged. Optimized WebP derivatives are in `public/media/`. The hardware setup photograph was rotated clockwise to make the workbench upright. The MOSFET photograph was resized for web use. Small illustrations represent the supplied hardware, with a generic vector fan, UPS and storage enclosure used for consistent visual explanation.

## Mushroom bag illustrations

The bare and fruiting bags were generated using the supplied tent artwork as a style reference. Local image processing removed the opaque background after generation. The two web assets share the same 466 × 1393 canvas and hanging anchor; underlying generated texture is not pixel-identical. They illustrate possible cultivation states and are never presented as real observations.

## Controlled-tent photographs

Three manually selected source photographs show the actual tent and hanging bags. Their local calendar dates are 19 August, 27 August and 4 September 2026 (Africa/Cairo, UTC+3). The source filenames contain a scheduled local capture time; the display deliberately gives dates rather than asserting a precise recorded second.

Source corpus: `oyster_2026_exp01/phase_1_incubation/controlled_camera/scientific_still/` in the experiment's existing media folder. Each original is 4608×2592; selected site images are 1600×900 WebP. The gallery contains no ambient-room imagery, test captures, generated predictions, or inferred growth metrics.

## Prepared incubation timelapse

Asset: `public/media/incubation-controlled-2026-08-18-to-09-05.mp4`.

- 73 real controlled-camera scientific stills, in scheduled-filename order.
- First scheduled capture: 18 August 2026, 18:40:42 Cairo.
- Last scheduled capture: 5 September 2026, 18:40:42 Cairo.
- 1280×720 H.264 MP4, approximately 12.17 seconds.
- Six source stills per second. Encoded at 30 fps by repeating frames; no optical flow, AI interpolation, invented photographs, or sensor-based processing.
- No audio.

The source photographs were not edited. Encoding was performed once outside the website build, and only the finished MP4 is served. No camera scheduler, image discovery process, media metadata API, or sensor-data integration exists in the frontend.

## Full 3D habitat illustration

The scene in `src/scripts/study/` is an authored procedural illustration of the full tent and workbench. Supplied hardware artwork and photographs guide the frame, sensors, cameras, computing equipment, and MOSFET modules. The straw bags and oyster clusters are modelled geometry. The original 2.5D artwork and existing research sections remain unchanged.

The revised scene exposes 33 individually indicated items. It follows the supplied frame reference with two internal hanging levels, two smaller bags and shorter ties, smaller sensors on the rear-left upright, two left-side tent cameras, a low right fan, low left vent, high duct entry, and diagonal roof LED. The enlarged table includes a monitor, keyboard, mouse, breadboard and four Wagos. Each MOSFET, power adapter, Wago, camera and bag is independently selectable. The Pi and raised AI board are shown as an explanatory cutaway; the two MOSFET boards are exposed, whereas the real modules are housed in black and white enclosures. Cable routes follow the user’s supplied connection description and corrected MOSFET table: device wires on the left, adapter wires on the right, black above red on both sides; bottom-left red and bottom-right black connect directly to sockets on the horizontal T-cobbler mounted on the breadboard. The four same-colour sensor pairs join through separate Wagos. The Pi has a T-cobbler ribbon, two camera ribbons, USB-A SSD connection and its UPS-fed official USB-C supply. The floor strip carries the UPS-fed 12 V and 24 V adapters. Hidden surfaces, fittings, material appearance and the display plinth remain illustrative approximations; the model does not establish deployed inference.

View regions, component close-ups, cover/wiring/mushroom/label toggles, fan/airflow, mist, lighting, camera-view demonstrations, and staged assembly replay change only the authored scene. They do not represent live readings, physical device states, controller events, actual camera coverage, or measured growth. The frontend loads the Three.js renderer on approach and serves static assets; it performs no experiment-data ingestion or device control.

LED mode uses separate rendering passes for the dim surrounding scene and the illuminated tent. Selecting the monitor turns on a static, clearly labelled Grafana mock-up image. The screen has its own power toggle and never changes the wiring layer. The image contains no measured values; the separate “View Data in Grafana” link remains the route to actual experiment data.

Current fallback assets:

- `public/media/full-habitat-poster.webp`
- `public/media/full-habitat-poster-mobile.webp`

These are actual browser-rendered screenshots of the expanded 3D scene, converted to WebP. They provide a still view while the renderer loads and when JavaScript or WebGL is unavailable. They are rendered illustrations, not camera captures or evidence of observed fruiting.

The retained `material-study-poster.webp` (1238 × 771) and `material-study-poster-mobile.webp` (688 × 942) show the earlier small material study: one PVC bay, one hanging bag, and an SCD41 enclosure. They are historical renders of that earlier scene, rather than the current full-habitat fallback images.

## Photograph and interaction sounds

The supplied `mushroom_picture.jpg` is shown to the left of the 3D scene on desktop and above it on smaller screens. `public/media/study/mushroom-{480,960}.webp` are resized derivatives; the source remains unchanged. It is an atmospheric mushroom photograph, not a dated observation from this experiment.

The sound files in `public/media/study/` are encoded once from the user’s media, with no runtime audio processing:

- `fan-loop.ogg`: source `fan.mp3`, exactly 00:04–00:10, a six-second loop.
- `humidifier-loop.ogg`: source `humidifier.mp3`, exactly 01:00–01:20, a twenty-second loop.
- `light-switch.ogg`: the complete supplied `light_switch.mp3`.
- `screen-switch.ogg`: the complete supplied `screen_sound.wav`.

Device loops start through visitor interaction and stop when the demonstration is stopped or dismissed. They pause when the model is offscreen or the tab is hidden, and resume only if that user-started demonstration is still active. The Sound control mutes all scene effects. Fan and mist demonstrations remain active until stopped. Reduced motion preserves a still illustration; it does not suppress user-requested sound.

`grafana-mockup.svg` is a single authored graphic used on the illustrated monitor and in its explanation card. Its curves are decorative, carry no measured values or time axis, and offer no dashboard controls, metric selectors, data requests or experimental-data processing.

## Footer photograph

`public/media/footer.webp` is a resized WebP copy of the supplied `media_for_astro_website/footer.jpg`, used as the shared footer background. It is decorative reference photography, not a photograph documenting this experiment's crop. The original file is unchanged.
