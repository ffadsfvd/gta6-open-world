// Hands in Solmara Heat (Node 22, standard library only). The game is game/: static files a
// desktop browser plays offline (index.html, its ES modules under game/src, styles, and three.js
// vendored as minified builds under game/vendor). This program copies game/ and screenshots/
// next to it into /output and writes /output/dossier.json, the summary the judge reads, with
// the kit's unchanged vendor/makefun-game.ts.
//
// Play it locally: `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR replaces /output:
//   mkdir out; $env:MAKEFUN_OUTPUT_DIR="out"; node main.ts      (PowerShell)
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts          (sh)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps: text_max_bytes shapes the dossier text; the rest make buildDossier refuse
// what the gate would refuse (over 4 screenshots or 256 KiB each, over 993 entries or 48 MiB in
// game/, a path over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
