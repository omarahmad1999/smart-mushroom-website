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

## Connected System sound effects

The diagram uses short edited excerpts from the previously selected Mixkit sound effects, under the [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree). Source catalogue: [Mixkit sci-fi sounds](https://mixkit.co/free-sound-effects/sci-fi/). These are incorporated sound cues for this website, not a sound library or downloads offered to visitors. Original WAV downloads stay outside the project; keep the licensed clips out of any public source/template distribution.

| Runtime clip | Mixkit title and asset ID | Source excerpt |
| --- | --- | --- |
| `node.mp3` | Sci Fi interface zoom — 890 | 0.218–0.868 s |
| `travel.mp3` | Fast sci fi transition sweep — 3114 | 0.143–0.793 s |
| `scramble.mp3` | Small sci fi glitch — 1030 | 0.772–0.992 s |
| `complete.mp3` | Sci Fi confirmation — 914 | 0.132–0.932 s |
| `click.mp3` | Sci fi click — 900 | 0.115–0.275 s |

Source files: `https://assets.mixkit.co/active_storage/sfx/{id}/{id}.wav`. Excerpts are mono 44.1 kHz MP3, filtered at 110–7000 Hz, peak-balanced, and faded at both ends. The browser plays them softly; sweep duration follows the visual handoff. Diagram sound defaults on and unlocks on the first click, tap, or keypress; reduced motion keeps it disabled. It has no connection to experiment data.

`public/media/study/light-switch.mp3` is a mono MP3 copy of the supplied `light_switch.mp3`, with tiny edge fades, used for LED switching across browsers. Fan and humidifier retain their previously prepared 6-second and 20-second excerpts and can now loop simultaneously.

## The Idea — early at-home photographs

Page 02 includes four supplied photographs from `media_for_astro_website/mushroom_pics_for_notebook/the_idea/`, in ascending capture-date order:

- `manual_mushroom_growing_1.jpg`: EXIF DateTimeOriginal, 14 October 2024.
- `manual_mushroom_growing_2.jpg`: EXIF DateTimeOriginal, 25 October 2024.
- `grown_mushroom.jpeg`: 1 February 2025, explicitly supplied by the user; no capture EXIF present.
- `manual_mushroom_dry.jpeg`: EXIF DateTimeOriginal, 19 April 2025.

Public derivatives in `public/media/notebook/idea/` are orientation-corrected WebP images, maximum 1400 pixels per side. Embedded metadata is omitted from public files. These are the user's earlier at-home experiments, not photographs from the 2026 controlled-tent run. Page 01 retains its existing image and text.

## Animated notebook cover

`public/media/notebook/cover/mushroom-growth-sheet.png` is an AI-generated pencil/coloured-pencil sprite sheet with twelve stages of an illustrative oyster cluster growing. The generated artwork is not an experiment observation. Equal grid cells were assembled with FFmpeg into `mushroom-growth.mp4`: approximately 5.2 seconds at 12 fps, stepped growth, a mature-stage hold, and a fade to cream paper before looping. `mushroom-growth-poster.webp` shows the final stage for reduced motion and before playback. No audio or runtime generation is involved.

The cover is absolutely positioned within the existing notebook binding; it adds no page or layout height. Open the notebook or choose a chapter to reveal the unchanged pages. View cover reopens it. Playback pauses offscreen, when the tab is hidden, when the cover is closed, or on explicit pause; reduced motion uses a still image.

## Page 03 — paired setup photographs

`entire_setup.jpg` in `media_for_astro_website/mushroom_pics_for_notebook/` records EXIF DateTimeOriginal `2026:08:22 17:33:32`. Both page-03 captions display 22 August 2026 as requested by the user; the workbench photograph's displayed date is user-assigned from that reference, not independently verified EXIF.

`public/media/notebook/build/entire-setup.webp` is a 1050 × 1400 derivative of the supplied entire-setup photograph. `workbench-cropped.webp` crops the existing 1200 × 1600 workbench image to x=230, y=0, width=970, height=1320, excluding the person's visible clothing/body at the left and bottom. Page 03 and its enlargement use this cropped derivative. The originals and images used elsewhere remain unchanged.

## The Journey — PVC frame photographs

The first Journey note uses four supplied construction photographs from `media_for_astro_website/mushroom_pics_for_notebook/`, kept in the order specified by the user: cut and washed pipes, incomplete assembly without diagonal support, complete frame before the X brace, and completed reinforced structure. Public WebP derivatives are stored in `public/media/notebook/journey/pvc/`, reduced to 1200 or 1400 pixels wide for the notebook and its image viewer. The originals remain unchanged.

`public/media/notebook/journey/pvc/00-initial-tent-design.webp` is a 1200 × 1104 WebP derivative of the supplied `0_initial_tent_design.png`. It appears only in the authored Initial design paper overlay with the user-provided PVC cut list; it is not generated from experiment data.

## The Journey — transparent enclosure photographs

The second Journey note uses `incomplete_transparent_plastic.jpg` followed by `complete_transparent_plastic.jpg`. The first public derivative was made with the built-in image editing tool and then reduced to a 1200 × 1022 WebP. The edit target was the supplied incomplete-enclosure photograph; the final prompt requested a crop around the transparent-plastic tent that excluded the visible legs, bed and broom while preserving the tent, PVC frame, black taped seam, perspective, lighting, colours and construction details. The completed-enclosure photograph is an orientation-corrected 1200 × 1600 WebP derivative. Both originals remain unchanged.

## The Journey — Raspberry Pi photographs

The third Journey note uses `initial_hardware_setup.jpg`, `pi_case.jpeg`, and `pi_breadboard_and_camera.jpg` in that order. Their paper date slips show the embedded EXIF `DateTime` values: 17 May 2026, 22 June 2026, and 28 June 2026. The photographs occupy the notebook’s facing page on wider screens; a Photos & Dates paper sticker opens them within the fixed notebook presentation on mobile.

`public/media/notebook/journey/raspberry-pi/02-pi-case-cropped.webp` was made with the built-in image editing tool. The final prompt requested a tight portrait crop that removed the laptop and unrelated objects from the upper part of the photograph while retaining the complete KSSB-style case, hand, orange ribbon cable, hardware geometry, lighting, colours, and photographic appearance, with no added text or graphics. The other two public files are orientation-corrected, resized derivatives. Public derivatives omit the original metadata; the supplied originals remain unchanged.
