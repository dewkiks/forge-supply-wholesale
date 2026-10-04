/**
 * postinstall: give @vendoai/ui charts a real categorical palette + gradients.
 *
 * vendo 0.5.0 derives ALL chart series from the single accent color (a
 * monochrome color-mix ramp in kit/tokens.js `chartSeries`) and offers no
 * palette prop or per-series CSS variable. Worse, generated app components
 * render inside an opaque-origin sandboxed iframe (the "component jail"), so
 * host CSS cannot recolor them — the palette must be changed in the package
 * itself, in BOTH copies of the kit:
 *   - dist/kit/tokens.js                    (host-DOM rendered components)
 *   - dist/tree/jail/runtime-bundle.gen.js  (kit bundled into the jail iframe)
 * and the gradient defs + fill CSS are injected into the jail document that
 * dist/tree/jail/JailedComponent.js builds (its CSP allows inline styles).
 *
 * Series 1 stays the accent (brand color, used by single-series charts);
 * series 2-5 become fixed hues from a CVD-validated categorical palette
 * (adjacent-pair colorblind separation and normal-vision distinctness all
 * pass on a white surface). Each carries a --vendo-chart-N variable hook so a
 * host page could still override them outside the jail.
 *
 * Idempotent; safe on pnpm hardlinked stores (unlink before write). Remove
 * this script if a future @vendoai/ui adds native palette support.
 */
import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgDir = join(root, 'node_modules', '@vendoai', 'ui');
if (!existsSync(pkgDir)) {
  console.log('[patch-vendo-charts] @vendoai/ui not installed, skipping');
  process.exit(0);
}
const dist = join(realpathSync(pkgDir), 'dist');

// Series color (bottom/base of gradient) and its lighter top stop.
const SERIES = {
  1: { base: '#2a78d6', top: '#5d9be4' }, // accent slot — gradient only
  2: { base: '#eb6834', top: '#f0906a' },
  3: { base: '#1baf7a', top: '#4cc79c' },
  4: { base: '#eda100', top: '#f5bc4a' },
  5: { base: '#e87ba4', top: '#f0a3c0' },
};

const esc = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Palette replacements as [before, after]; `q` is the file's quote style. */
function ramp(q) {
  const s = (v) => `${q}${v}${q}`;
  return [
    [
      s('color-mix(in srgb, var(--vendo-color-accent, #111111) 55%, var(--vendo-color-surface, #ffffff))'),
      s(`var(--vendo-chart-2, ${SERIES[2].base})`),
    ],
    [
      s('color-mix(in srgb, var(--vendo-color-accent, #111111) 30%, var(--vendo-color-surface, #ffffff))'),
      s(`var(--vendo-chart-3, ${SERIES[3].base})`),
    ],
    // The muted var string alone is shared with axis ticks — anchor slot 4 to
    // its unique neighbor (the danger-mix entry that follows it in the array).
    // Whitespace-tolerant: one line in the minified jail bundle, indented
    // lines in kit/tokens.js.
    [
      new RegExp(
        `,\\s*${esc(s('var(--vendo-color-muted, #6b6b76)'))},(\\s*)${esc(q)}color-mix\\(in srgb, var\\(--vendo-color-danger`,
        'g',
      ),
      `,${s(`var(--vendo-chart-4, ${SERIES[4].base})`)},$1${q}color-mix(in srgb, var(--vendo-color-danger`,
    ],
    [
      s('color-mix(in srgb, var(--vendo-color-danger, #c62f2f) 70%, var(--vendo-color-accent, #111111))'),
      s(`var(--vendo-chart-5, ${SERIES[5].base})`),
    ],
  ];
}

// Injected into the jail's inner document body: hidden SVG gradient defs plus
// CSS that swaps each series' flat fill for its gradient. Selectors match the
// literal fill ATTRIBUTE strings the kit writes (scoped to chart containers;
// axis/label <text> excluded). CSP allows this: style-src 'unsafe-inline'.
const seriesFill = (n) =>
  n === 1 ? 'var(--vendo-color-accent, #111111)' : `var(--vendo-chart-${n}, ${SERIES[n].base})`;
const JAIL_DECOR =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  Object.entries(SERIES)
    .map(
      ([n, c]) =>
        `<linearGradient id="vendo-grad-${n}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${c.top}"/><stop offset="100%" stop-color="${c.base}"/>` +
        `</linearGradient>`,
    )
    .join('') +
  '</defs></svg>' +
  '<style>' +
  Object.keys(SERIES)
    .map((n) => `[data-kit] :is(path,rect)[fill="${seriesFill(Number(n))}"]{fill:url(#vendo-grad-${n})}`)
    .join('') +
  '</style>';

function patchFile(path, marker, replacements) {
  if (!existsSync(path)) {
    console.warn(`[patch-vendo-charts] missing ${path} — vendo layout changed?`);
    return;
  }
  let text = readFileSync(path, 'utf8');
  if (text.includes(marker)) {
    console.log(`[patch-vendo-charts] already patched: ${path}`);
    return;
  }
  for (const [before, after] of replacements) {
    const count =
      before instanceof RegExp
        ? (text.match(before) || []).length
        : text.split(before).length - 1;
    if (count !== 1) {
      console.warn(
        `[patch-vendo-charts] expected 1 occurrence, found ${count} in ${path} for: ${String(before).slice(0, 60)}… — skipping file`,
      );
      return;
    }
    text = text.replace(before, after);
  }
  unlinkSync(path); // break pnpm store hardlink before writing
  writeFileSync(path, text);
  console.log(`[patch-vendo-charts] patched ${path}`);
}

patchFile(join(dist, 'kit', 'tokens.js'), '--vendo-chart-2', ramp('"'));
// The jail bundle is a JS file that EMBEDS the runtime as a string literal, so
// its quotes are escaped.
patchFile(join(dist, 'tree', 'jail', 'runtime-bundle.gen.js'), '--vendo-chart-2', ramp('\\"'));
// Gradient defs + fill CSS into the jail's inner document.
patchFile(join(dist, 'tree', 'jail', 'JailedComponent.js'), 'vendo-grad-1', [
  [
    '"<title>Generated Vendo component</title></head><body>",',
    `"<title>Generated Vendo component</title></head><body>" + ${JSON.stringify(JAIL_DECOR)},`,
  ],
]);
// --- Jail PNG export -------------------------------------------------------
// Generated islands render inside the opaque-origin jail iframe, which host
// DOM rasterization cannot see into (VendoAppMessage exports came out blank
// for island apps). Embed a rasterizer (html-to-image UMD, ~20KB, global
// `htmlToImage`) plus a message listener into the jail's INNER document; the
// host asks {kind:"vendo-export-png",requestId} through the existing relay
// (host → outer → inner) and gets {kind:"vendo-export-png-result",requestId,
// dataUrl} back, then swaps the iframe for that image during its own capture.
// Jail CSP allows this: nonce'd inline script, img-src data:. skipFonts stays
// on because connect-src 'none' blocks font fetches.
const requireHere = createRequire(import.meta.url);
let jailExportSource = null;
try {
  const umd = readFileSync(requireHere.resolve('html-to-image/dist/html-to-image.js'), 'utf8');
  const listener =
    'window.addEventListener("message",function(e){var d=e.data;' +
    'if(!d||d.kind!=="vendo-export-png")return;var q=d.requestId;' +
    'function send(p){p.kind="vendo-export-png-result";p.requestId=q;parent.postMessage(p,"*")}' +
    'try{htmlToImage.toPng(document.body,{pixelRatio:2,skipFonts:true,backgroundColor:d.background||"#ffffff"})' +
    '.then(function(u){send({dataUrl:u})},function(err){send({error:String(err)})})}' +
    'catch(err){send({error:String(err)})}});';
  jailExportSource = (umd + '\n' + listener).replace(/<\/script/gi, '<\\/script');
} catch {
  console.warn('[patch-vendo-charts] html-to-image not resolvable — jail PNG export not patched');
}
if (jailExportSource) {
  patchFile(join(dist, 'tree', 'jail', 'JailedComponent.js'), 'vendo-export-png', [
    [
      '`<script nonce="${nonce}">${safeRuntime}<\\/script>`,\n        "</body></html>",',
      // Function replacement: the 20KB payload may contain `$&`-style
      // sequences that String.replace would otherwise expand.
      () =>
        '`<script nonce="${nonce}">${safeRuntime}<\\/script>`,\n' +
        '        "<script nonce=\\"" + nonce + "\\">" + ' +
        JSON.stringify(jailExportSource) +
        ' + "<\\/script>",\n' +
        '        "</body></html>",',
    ],
  ]);
}

// The embed's build-polling cutoff is a compiled-in browser constant (4min
// watchdog + 60s). The server watchdog is raised to 8min via
// VENDO_APP_BUILD_WATCHDOG_MS (complex dashboard builds take 3-5+ min on
// gemini-3-flash-preview); the UI cutoff must strictly exceed it, so pin 9min.
patchFile(join(dist, 'chrome', 'embeds.js'), 'APP_BUILD_DEADLINE_MS = 540000', [
  [
    'const APP_BUILD_DEADLINE_MS = effectiveAppBuildUiDeadlineMs();',
    'const APP_BUILD_DEADLINE_MS = 540000;',
  ],
]);
