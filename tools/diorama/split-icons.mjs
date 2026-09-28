// Splits Phosphor duotone icons into an outline SVG and an inside SVG (the translucent layer), so the
// Blender scene can give each its own material: the outline stays ink and the fill takes the colour.
//   node tools/diorama/split-icons.mjs <out-dir> thermometer cloud note-pencil
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [out, ...names] = process.argv.slice(2);
for (const name of names) {
  const svg = readFileSync(`node_modules/@phosphor-icons/core/assets/duotone/${name}-duotone.svg`, 'utf8');
  const paths = [...svg.matchAll(/<path d="([^"]+)"( opacity="[^"]+")?\s*\/>/g)];
  const wrap = d => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${d.map(path => `<path d="${path}"/>`).join('')}</svg>`;
  writeFileSync(join(out, `${name}-line.svg`), wrap(paths.filter(path => !path[2]).map(path => path[1])));
  writeFileSync(join(out, `${name}-inside.svg`), wrap(paths.filter(path => path[2]).map(path => path[1])));
  console.log(name, 'outline paths', paths.filter(path => !path[2]).length, 'fill paths', paths.filter(path => path[2]).length);
}
