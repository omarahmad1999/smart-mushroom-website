// Writes one diorama layout as JSON for the Blender scene script, straight from the site's own data,
// so the model and the page always agree on where every part stands.
//   node tools/diorama/layout-json.mjs observe wide > observe-wide.json
import { dioramas } from '../../src/scripts/diorama/paths.ts';
const [pathway = 'observe', layout = 'wide'] = process.argv.slice(2);
const diorama = dioramas[pathway];
process.stdout.write(JSON.stringify({ pathway, layout, ...diorama.layouts[layout], parts: diorama.parts, links: diorama.links }, null, 1));
