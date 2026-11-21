# Smart Mushroom Hub: the website

**Live at [micolabs.dev](https://micolabs.dev).** The code that runs the tent itself (sensors, controllers, cameras and database) is in **[smart-mushroom-hub](https://github.com/omarahmad1999/smart-mushroom-hub)**, and the measurements are on a [read-only Grafana dashboard](https://grafana.micolabs.dev/public-dashboards/40bb16eb47d94967a3b7c62815763862).

A mostly static, interactive case study about an oyster mushroom cultivation experiment. The homepage opens with the interactive Three.js habitat and workbench, followed by the Connected System animation, experiment narrative, cultivation phases, photographs, timelapse, and computer-vision work. All pages are pre-rendered; one small server endpoint sends the About page contact form through Resend.

## Run locally

Use Node 24 (or a supported Node version >=22.12):

```sh
nvm use
npm ci
npm run dev
```

Open http://localhost:4322. The project uses Astro's static output and GSAP for visual animation. The contact form is the only server-side route.

```sh
npm run check
npm run build
npm run serve
```

The Node adapter writes the pre-rendered site and contact endpoint to `dist/`. Production hosting must run `dist/server/entry.mjs`; `npm run serve` does that locally and reads an ignored `.env` file when present. Set `HOST` and `PORT` in the hosting environment when needed.

## Deployment

`npm run deploy` builds the site here and publishes it to the hosting server (SSH alias `friend`; override with `DEPLOY_HOST`). It copies `dist/`, the package files and `deploy/ensure-running.sh` to `~/micolabs`, reinstalls runtime dependencies when the lockfile changes, restarts the site and confirms it answers.

On the server, everything lives in the home folder and needs no admin rights: Node in `~/.local/opt/node`, `cloudflared` in `~/.local/bin`, the tunnel token in `~/.cloudflared/tunnel-token`, and the contact secrets in `~/micolabs/.env`. The site listens on `127.0.0.1:4321` only. Visitors reach it through a Cloudflare Tunnel, so the server's address never appears in DNS. Cron runs `ensure-running.sh` at boot and every minute to start the site or tunnel if either has stopped; logs are in `~/micolabs/logs`.

## Project links

Copy `.env.example` to `.env` and set the actual public destinations:

```dotenv
PUBLIC_GRAFANA_URL=https://your-grafana-dashboard-url
PUBLIC_GITHUB_URL=https://github.com/your-account/your-project
PUBLIC_DOCUMENTATION_URL=
```

Rebuild after changing these values. The documentation link defaults to the working local `/documentation/` page. Until Grafana/GitHub URLs are supplied, the buttons explain that the public link is unavailable rather than sending visitors to a guessed destination. The site validates HTTP(S) URLs at build time; these settings are links, not data sources.

## Contact email

The About page posts its contact form to `/api/contact`, which validates and escapes the message before sending it through Resend. Copy the private settings from `.env.example` into an ignored `.env` file for local development, or add them to `~/micolabs/.env` on the hosting server. They are read when a message is sent and are never copied into the build output:

```dotenv
RESEND_API_KEY=your-new-sending-only-key
CONTACT_TO_EMAIL=you@example.com
CONTACT_FROM_EMAIL=Smart Mushroom Hub <onboarding@resend.dev>
```

Never prefix the API key with `PUBLIC_`, place it in browser code, paste it into chat, or commit `.env`. `onboarding@resend.dev` is useful for an initial test to the Resend account owner. Replace it with an address on a verified sending domain for production. The form sets the visitor's address as `Reply-To` and includes a same-host check, field limits, a honeypot, and an in-memory rate limit.

## Architecture boundary

**Grafana is the only place that displays actual sensor data.** The website has no database driver, TimescaleDB connection, experiment-data API, readings, chart library, aggregation, data cache, polling, WebSocket client, public-data manifest, metric selector, or time-range selector. The contact endpoint handles authored visitor messages only. The development server's own HMR tooling is absent from production output.

The system diagram explains the existing experiment infrastructure. It does not connect to that infrastructure. All controls on the website change illustrations or reveal authored text; none control physical devices.

## Content and assets

- `src/components/ResearchChapters.astro`: experiment narrative, conceptual cultivation stages, manually curated camera gallery, pre-produced video, and computer vision.
- `src/components/SystemArchitecture.astro`: conceptual Observe / Respond / Record routes.
- `src/components/MaterialStudy.astro`: the opening full-habitat 3D section, component inspector, view controls, and static fallback.
- `src/scripts/material-study.ts`: loads the optional 3D renderer as its section approaches the viewport.
- `src/scripts/study/`: authored component explanations, procedural tent/workbench geometry, and local visual interactions.
- `src/pages/documentation.astro`: static system notes, linked as Field Notes.
- `src/components/ExperimentRuns.astro` and `src/content/runs/`: each experiment run, what failed and what it changed.
- `src/components/SiteFooter.astro`: supplied mushroom photograph with navigation and GitHub/Grafana icons.
- `src/config/site.ts`: public destination links and editorial site metadata.
- `public/media/`: prepared images and video served as static files.
- `scripts/prepare_assets.py`: optional offline preparation of the provided artwork. It requires Pillow, NumPy and OpenCV and is not part of the site build/runtime. Source media is left unchanged.

The mushroom bags, UPS and storage drawings are illustrations. They are not experiment photographs. The selected controlled-tent photographs are real captures dated 19 August, 27 August and 4 September 2026 (Cairo local dates). Camera sidecars are not published or consumed by the website.

The 12.17-second incubation timelapse was prepared offline from 73 actual controlled-camera scientific stills, from 18 August through 5 September 2026. Six source stills play each second; the encoded video is 30 fps with repeated frames, not AI-interpolated growth. This is a finished media artifact. See `MEDIA_NOTES.md` for provenance.

The computer-vision chapter tells the public-data attempt as it happened: a YOLO11 model trained on another farm's photos ran on the Pi's Hailo-10H but failed in this tent. No detections are shown until the model has been retrained on the project's own photographs.

## Browser checks

```sh
npm test
```

Tests use system Chromium by default. Set `CHROMIUM_PATH` to another Chromium executable if needed. For a running production static site:

```sh
BASE_URL=http://127.0.0.1:4323 TEST_PRODUCTION=1 npm test
```

The suite covers desktop/mobile layouts, hardware selection, visual layer toggles, phase and architecture tabs, media loading, navigation, dialog focus, reduced motion, no-JavaScript reading, and the absence of application data requests. The 3D checks additionally cover lazy loading, WebGL rendering, camera controls, native scrolling, static fallbacks, all 33 item explanations, view regions, illustrative demonstrations, and reduced-motion assembly replay. Those checks allow extra time for software WebGL on the ARM test host.

## Separate 3D habitat

The `/#material-study` section opens the homepage with the full tent and workbench. Connected System follows immediately, then the research chapters. Three.js draws authored geometry; there is no connection to experiment services.

The inspector has 33 individually numbered items. The bags, cameras, fan and LED MOSFETs, four Wagos, and each power adapter have independent indicators, alongside the frame, cover, fan, vent, humidifier, duct, LED, sensors, Pi, AI HAT, SSD, table, monitor, keyboard, mouse, breadboard, T-cobbler, UPS and power strip. Indicators move apart with fine leader lines when crowded; the component list offers the same explanations.

The interaction controls provide:

- Whole-setup, tent, and workbench views, plus close-ups of selected components.
- Cover, wiring, mushroom, and label toggles.
- On/off fan, mist, lighting, and camera-view demonstrations. LED mode dims the surrounding scene and lights the tent in a separate rendering pass.
- A static Grafana mock-up on the monitor, with a separate screen power switch.
- Supplied light/screen switch sounds and pre-trimmed fan (00:04–00:10) and humidifier (01:00–01:20) loops, with a mute control.
- A staged build replay; reduced-motion mode shows the completed assembly immediately.
- Drag or arrow-key rotation, zoom buttons or +/−, and Home or Reset to restore the view.

All of these controls affect the illustration only. The revised frame, two internal hanging levels, smaller bags and sensors, low fan and vent, high duct inlet, and two tent cameras follow the supplied reference. Hidden surfaces and small fittings remain illustrative approximations. The exposed Pi, raised AI board, and exposed MOSFET modules are explanatory views. Wiring follows the supplied description: sensor pairs join in four Wagos before terminating on the horizontal T-cobbler; the T-cobbler, cameras, USB-A SSD and official USB-C supply connect to the Pi; the UPS feeds its charger and the strip carrying 12 V and 24 V adapters. Each MOSFET uses the corrected left load / right supply terminals, black above red, with red bottom-left and black bottom-right going directly to the T-cobbler. Each MOSFET inspector includes this terminal table. The keyboard and mouse are wireless; the relocated SSD uses USB-A and the monitor uses micro-HDMI at the Pi. The charger and floor-strip plug are seated in the UPS. Mushroom clusters show a conceptual fruiting state; they do not document observed growth. The model does not establish that edge inference is deployed.

The renderer loads as the section approaches the viewport. Wheel scrolling remains native, vertical touch gestures scroll the page, and rendering pauses while idle or offscreen. Automatic rotation is opt-in; camera transitions respect reduced-motion preferences. Sounds also pause offscreen and in hidden tabs. The section uses procedural geometry and a local static monitor texture; it imports no GLB models or remote assets. The supplied mushroom photograph sits to the left on desktop and above the model on small screens.

`public/media/full-habitat-poster.webp` and `full-habitat-poster-mobile.webp` are screenshots of the expanded 3D renderer, used for loading, no-JavaScript, and unavailable-WebGL states. The original `material-study-poster*.webp` images remain as stills of the earlier small scene. These rendered illustrations are distinct from the real camera photographs and prepared timelapse; see `MEDIA_NOTES.md`.

## Animated system pathways

All three tabs in “The connected system” share `src/components/SystemFlow.astro` and `src/scripts/system-flow.ts`. Observe keeps SHT31 and SCD41 vertically aligned, activates them together, merges their paths, and finishes at Grafana. Desktop nodes are staggered along rounded, forward-moving routes, with captions placed beside their respective connections and room around “Send Readings”. Respond traces inputs → controllers → MQTT → actuator services → devices. Record has four nodes and ends at Media Preparation; the former Research Website node has been removed.

The diagrams retain the white surface and raised white tiles, with dark orange and muted green bolts. Layered grey grooves give the paths an etched appearance; concave-corner geometric surrounds have a dot in each cut-out and light up in bright orange with a softly grained finish. The brighter hue retains the same opacity. Travelling streams have a deforming rounded head and tapered tail following the SVG curves, with all motion controlled by the same pausable timeline. The overall pace is slightly slower. Grey connection paths are visible from the start and remain grey throughout; bolts leave no coloured trails. Lettering uses darker orange and green for readability on white. Nodes stay neutral until their turn, then remain lit. Titles scramble into their names while captions reveal and fade character by character. The last connection and node turn green, paired with an orange caption. Captions and titles capitalize every word while preserving product spelling.

Connection bolts use the same distance per second as node border sweeps. Travel times come from the displayed SVG geometry, so the longer mobile paths take proportionally longer. Captions and activations follow each arrival. Every pathway plays once, holds its completed state, and has independent Pause and Replay controls. It pauses offscreen, in hidden tabs, or when another pathway is selected. A responsive layout change restarts the sequence for the new geometry while retaining an explicit pause.

Reduced motion and no-JavaScript views keep the entire explanation readable. SVG definitions and playback are scoped to each pathway. All content and motion are authored; no experiment readings, data APIs, database connections, polling, or backend services are used by the website.

The opening hardware catalogue (“Every piece has a purpose”) is a native disclosure, closed by default. The photograph caption includes the right-aligned Explore the experiment link. The former 2.5D hero and resource directory section have been removed; GitHub and Grafana remain in the header and photo footer.

Connected System has a shared **Sound off / Sound on** toggle. Sound defaults on. The first click, tap, or keypress unlocks five small local Mixkit clips and restarts the selected pathway; the toggle can mute them at any time. Node activation, title scramble, travelling bolts, final confirmation, and control clicks have distinct cues. Both initial sensor branches share one sweep. Sound stops on mute, pause, tab changes, offscreen suspension, and page hiding; it stays disabled with reduced motion. Source/licence notes are in `MEDIA_NOTES.md`. No diagram audio requests occur before the first interaction, and no remote audio is loaded by the browser.

The fan, humidifier and LED are independent illustration switches. Their states survive component selection, closing the inspector, changing view regions, and camera manipulation. Fan and humidifier loops can play together. Orange indicators show the three controllable devices and a stronger fill marks active ones. The LED uses an MP3 copy of the supplied light-switch sound on both on and off actions. Replay build clears device demonstrations; offscreen/hidden pages suspend their audio without forgetting the states.

Switching on the LED restores the whole-habitat view; switching on the humidifier frames the duct and mist, and switching on the fan restores its component view. Visitors can then freely orbit and zoom while all active devices keep running. Switching a device off leaves the camera in place.

The Field Notes page (`/documentation/`) opens as an interactive paper notebook with six sections: The Idea, The Build, Growing Notes, Vision Lab, The Journey, and What Went Wrong. Edit `src/content/notebook/*.md` to change entries; frontmatter supplies the photograph, caption, image note, section tab, and reference link. The Markdown body supplies the facing page. Entries are compiled at build time, with no runtime content service. Existing detailed documentation and its anchor links remain below the notebook.

Notebook navigation supports tabs, contents, previous/next buttons, clickable or draggable corners, horizontal swipes, and arrow keys. Desktop shows two facing pages; mobile shows one page at a time. Section URLs (and mobile `--notes` URLs) restore the selected page, including through browser history. Photographs open in an accessible native dialog; numbered notes expand on the page. Caveat is bundled locally for handwriting accents. Reduced motion disables page folds, and without JavaScript all entries and direct photograph links remain readable. Printing includes every entry.

The Journey is chapter 05, with twelve coloured paper mini sections edited in `src/content/journey/*.md`. On wide screens the fully labelled paper tabs extend outside the right edge, absolutely positioned without changing the notebook’s size, position, or margins. Narrow screens retain the compact overlay tabs, whose labels expand on hover or focus. The notebook keeps the same dimensions across chapters. Each note has a shareable `#journey-…` URL; browser history restores the selected note. What Went Wrong is chapter 06.

The notebook now opens on an illustrated cover when `/documentation/` has no fragment. Its local, silent MP4 plays twelve hand-drawn mushroom-growth stages, holds on the mature cluster, and fades back to paper. Open the notebook reveals the existing first page; View cover reopens the cover. Chapter and reference deep links bypass it. The cover is an absolute layer within the existing binding, preserving the `b67bcf0` dimensions (1236 × 779.14 px at a 1440 px viewport; 346 × 983.72 px at 390 px). Playback respects explicit pause, visibility, and reduced motion. The source sprite sheet, finished video, and still poster are in `public/media/notebook/cover/`.

The closed cover is centred and half the open spread’s width on desktop, with a visible spine and paper edges. On mobile it remains one page wide. Opening reveals the accepted full-size notebook in its original position; chapter tabs stay hidden while the cover is closed. The underlying layout footprint is retained to avoid moving the surrounding page.
