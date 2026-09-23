# Website design review

Reviewed 23 September 2026 using Taste's design and existing-project audit instructions, browser screenshots, interaction checks, and source inspection. No website design or behavior was changed.

## Scope and installation

Installed from [the official Taste repository](https://github.com/Leonxlnx/taste-skill), linked by [tasteskill.dev](https://www.tasteskill.dev/):

- `skills/taste-skill` → `~/.codex/skills/design-taste-frontend`
- `skills/redesign-skill` → `~/.codex/skills/redesign-skill` (skill name: `redesign-existing-projects`)

These are instructions for the agent, not a browser or a website dependency. They were read and applied during this review; subsequent turns can discover the installed skills automatically.

Reviewed the locally running Home, Field notes, and About me pages at desktop 1440 × 1000 and mobile 390 × 844. Exercised notebook opening, page turning and Journey selection; all three software-flow tabs; mobile navigation; About tabs; contact dialog opening and closing; and the Grafana unavailable-link dialog. Browser evidence is temporary under `/tmp/taste-audit/`.

## Design direction to preserve

This is a personal research journal about a working mushroom habitat. The cream and olive palette, handwritten notes, real photographs, notebook, interactive tent, and Myko give it a recognizable identity. A generic technology landing-page redesign would lose that specificity. Improve clarity, reading comfort, and navigation within the current design.

## Prioritized findings

### 1. Connect the primary resource links

**High priority.** In the local build, GitHub and Grafana controls open unavailable-link dialogs rather than their destinations. Clicking Grafana confirmed that the public dashboard URL has not been added.

Configure the intended public URLs through the existing `PUBLIC_GITHUB_URL` and `PUBLIC_GRAFANA_URL` configuration. Until destinations are available, retain an honest unavailable state. Grafana must remain responsible for actual measurements and charts; no replacement dashboard is proposed.

### 2. Give floating elements a safe place

**High priority.** The Contents tab overlaps the opening headline. Myko covers part of the About biography and education content, especially on narrow screens.

Reserve space for the Contents control or place it in the header on narrow screens. Give Myko a clear docking area; consider a compact mobile state that visitors can expand. Keep the character, grass, and contact interaction, but prevent them from obscuring reading and navigation.

### 3. Bring the main experience into view sooner

**High priority.** At the tested desktop size, the Explore button begins about 1081 px down, below the first viewport. On mobile, the tall mushroom photograph precedes the interactive tent; the scene starts about 973 px down.

Tighten the space before the main visuals on desktop while preserving the intended button alignment. On mobile, consider putting the interactive scene before the supporting photograph or reducing the photograph's prominence. Add a short, plain statement of the experiment's purpose near the headline, for example: “An automated oyster-mushroom habitat exploring growing conditions, growth, and computer vision.”

### 4. Stop mobile Journey tabs covering the writing

**High priority.** On the mobile Journey writing page, the twelve tabs initially appear as numbers. Selecting Raspberry Pi expands their labels over much of the text, and the expanded state persists after selection.

Use an explicit “Choose a build step” menu that closes after selection, with named topics. Preserve the accepted notebook dimensions across every section and responsive layout. This recommendation does not require shrinking text, shrinking images, or adding pages. The observed issue is overlapping navigation, not demonstrated internal content overflow.

### 5. Strengthen reading and navigation hierarchy

**Medium priority.** Main navigation is approximately 11 px and About body copy approximately 13 px despite generous surrounding space. Some auxiliary labels are smaller still. The main navigation also lacks a persistent current-page indicator and `aria-current`.

Increase important navigation and body text outside the notebook, keeping tiny text for secondary metadata. Add a visible active-page cue and the corresponding semantic attribute. Keep the current serif and handwriting character. Contrast should be measured before making any accessibility-conformance claim.

### 6. Make section headings more specific

**Medium priority.** Home repeatedly uses variations of “A small … A whole/bigger/considered …”. Repeating the same large-heading treatment makes different sections feel more alike than their content warrants.

Keep the opening headline, but make subsequent headings describe their content: for example, “How the habitat works” and “What the experiment asks.” Vary heading scale where useful while preserving the established section order.

### 7. Offer a reading view for the animated pathways

**Medium priority.** Node names appear with the animated sequence, so a visitor arriving mid-animation can initially see mostly unnamed nodes. The existing scramble and traveling-pulse effects are intentional and should remain available.

Consider an optional “Show full pathway” reading view alongside the existing controls. Pause, replay, and reduced-motion handling already exist; these are not missing features. Do not connect these illustrations to live experiment data.

### 8. Help newcomers enter the hardware scene

**Optional refinement.** Many numbered indicators appear together, so a new visitor must explore before knowing where to begin.

Consider a few named introductory choices, such as climate, cameras, and computing, while retaining access to every component and its indicator. Treat this as a proposed navigation enhancement, not permission to remove the detailed component exploration.

## What worked in the tour

- Real dated photographs and the produced timelapse give the project credibility and specificity.
- The desktop notebook spread is visually coherent; its dimensions should remain unchanged.
- The tested routes had no horizontal overflow at either viewport size.
- No JavaScript page errors were recorded during the tour.
- Notebook controls, software-flow tabs, About tabs, mobile navigation, and the contact dialog responded in the tested interactions.
- Existing focus, skip-link, and reduced-motion provisions should be retained.

## Limits

This was a local browser review, not a production performance or complete accessibility audit. Headless rendering used software graphics, so its speed is not evidence of real-device Three.js performance. Not every hardware toggle was exercised. No contact form was submitted, and email delivery was not tested. Hidden lazy-loaded images were not classified as broken merely because they had not loaded. Resource-link availability refers to this local build, not an independently verified deployed site.

## Suggested first implementation batch

Connect real resource URLs, resolve floating-control overlaps, improve the mobile hero order, and replace the mobile Journey tab overlay with a closing selector. Then refine typography, active navigation, and headings. None of these changes requires replacing the site's visual identity, resizing the notebook, or adding experiment-data infrastructure.
