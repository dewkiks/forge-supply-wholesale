/**
 * VendoAppMessage — renders a vendo-built micro-app inside a chat message.
 *
 * When a workflow agent answers a data-shaped question it may call the
 * vendo_create_app tool; the run then emits a `vendo_app` event and the chat
 * hook attaches `msg.vendoApp` to that turn. Render it with:
 *
 *   {msg.vendoApp
 *     ? <VendoAppMessage vendoApp={msg.vendoApp} />
 *     : <MarkdownText>{msg.content}</MarkdownText>}
 *
 * The embed shows vendo's build-beat while the app streams, then the live app
 * (charts, tables, stats) — IMPORT this component; never rewrite it.
 *
 * Wire: talks to `${apiUrl}/api/vendo/*` (FlowBuilder proxy) authenticated
 * with the app's existing ByteFlow session token.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { VendoProvider, VendoAppEmbed, createVendoClient, defaultVendoTheme } from '@vendoai/ui';
import { Download, Loader2 } from 'lucide-react';
import { getByteflowConfig, exchangeForSessionToken } from '../config/byteflow';

export interface VendoAppInfo {
  appId: string;
  title?: string;
  ref?: unknown;
}

// Partial theme override (vendo docs: "Make it yours" — VendoProvider.theme).
// Vendo's defaultVendoTheme is deliberately unbranded (accent #111111), which
// renders every chart black. Theming is a HOST responsibility in vendo (the
// wire carries no theme; `vendo init` extracts the host brand at build time),
// so we mirror that flow: the app BUILDER writes this app's brand into
// src/config/vendo-theme.ts alongside the palette, and the embed applies it.
// Series 1 and vendo's buttons/links follow it.
import { VENDO_BRAND } from '../config/vendo-theme';

const ACCENT_FALLBACK = { base: '#2a78d6', top: '#5d9be4' };

let appAccent: { base: string; top: string } | null = null;
function resolveAppAccent(): { base: string; top: string } {
  if (appAccent) return appAccent;
  let out = ACCENT_FALLBACK;
  const hex = (VENDO_BRAND?.accent || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const max = Math.max(r, g, b);
    const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    // Chart-worthiness gates: enough chroma to read as a color, mid
    // luminance so marks contrast a white surface and hold white text.
    if (sat >= 0.08 && lum >= 0.12 && lum <= 0.7) {
      const lift = (c: number) =>
        Math.round(c + (255 - c) * 0.35)
          .toString(16)
          .padStart(2, '0');
      out = {
        base: hex.toLowerCase(),
        top: `#${lift(r)}${lift(g)}${lift(b)}`,
      };
    }
  }
  appAccent = out;
  return out;
}

function buildVendoTheme() {
  return {
    colors: {
      ...defaultVendoTheme.colors,
      accent: resolveAppAccent().base,
      accentText: '#ffffff',
      border: '#e8e8ee',
    },
    radius: { small: '8px', medium: '12px', large: '18px' },
  };
}

// Multi-hue chart series (series 2-5) are handled at install time by
// scripts/patch-vendo-charts.mjs — vendo's kit hardcodes a monochrome accent
// ramp, so the palette lives in the patched package (both the host kit and
// the sandboxed-iframe fallback bundle).

// Gradient dressing for chart marks. Compiled app components normally mount
// in the host DOM, so one hidden <defs> block plus fill CSS (keyed on the
// exact fill-attribute strings the patched kit writes) upgrades every bar and
// donut slice to a vertical gradient. Axis/label <text> is untouched.
// Series 1 (the accent slot) follows the app brand; series 2-5 stay fixed,
// CVD-validated hues so multi-series charts remain readable on any brand.
function chartSeries(): Array<{ fill: string; top: string; base: string }> {
  const accent = resolveAppAccent();
  return [
    { fill: 'var(--vendo-color-accent, #111111)', ...accent },
    { fill: 'var(--vendo-chart-2, #eb6834)', top: '#f0906a', base: '#eb6834' },
    { fill: 'var(--vendo-chart-3, #1baf7a)', top: '#4cc79c', base: '#1baf7a' },
    { fill: 'var(--vendo-chart-4, #eda100)', top: '#f5bc4a', base: '#eda100' },
    { fill: 'var(--vendo-chart-5, #e87ba4)', top: '#f0a3c0', base: '#e87ba4' },
  ];
}

let chartDecorInjected = false;
function ensureChartDecor() {
  if (chartDecorInjected || typeof document === 'undefined') return;
  chartDecorInjected = true;
  const CHART_SERIES = chartSeries();
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML =
    '<svg width="0" height="0"><defs>' +
    CHART_SERIES.map(
      (s, i) =>
        `<linearGradient id="vendo-grad-${i + 1}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${s.top}"/><stop offset="100%" stop-color="${s.base}"/>` +
        `</linearGradient>`,
    ).join('') +
    '</defs></svg>';
  document.body.appendChild(holder);
  const style = document.createElement('style');
  style.textContent =
    CHART_SERIES.map(
      (s, i) => `[data-kit] :is(path,rect)[fill="${s.fill}"]{fill:url(#vendo-grad-${i + 1})}`,
    ).join('\n') +
    '\n[data-kit="BarChart"] path.recharts-rectangle{transition:filter .15s ease}' +
    '\n[data-kit="BarChart"] path.recharts-rectangle:hover{filter:brightness(1.07)}' +
    '\n[data-kit="DonutChart"] path.recharts-sector{transition:filter .15s ease}' +
    '\n[data-kit="DonutChart"] path.recharts-sector:hover{filter:brightness(1.07)}' +
    // Long builds (complex dashboards run minutes): vendo's build skeleton is
    // static, which reads as "stuck" — add a shimmer sweep so it stays alive.
    '\n@media (prefers-reduced-motion: no-preference){' +
    '@keyframes vendo-skel-shimmer{from{transform:translateX(-100%)}to{transform:translateX(250%)}}' +
    '.fl-slot-skel .fl-skel-line{position:relative;overflow:hidden}' +
    '.fl-slot-skel .fl-skel-line::after{content:"";position:absolute;inset:0;' +
    'background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);' +
    'animation:vendo-skel-shimmer 1.6s ease-in-out infinite}}';
  document.head.appendChild(style);
}

// One token exchange per page load, shared by every embed instance.
let tokenPromise: Promise<string> | null = null;
function getWireToken(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = exchangeForSessionToken().catch((e) => {
      tokenPromise = null; // allow retry on the next mount
      throw e;
    });
  }
  return tokenPromise;
}

// Generated-island apps render inside vendo's opaque-origin jail iframe,
// which host DOM rasterization cannot see into. The install-time package
// patch (scripts/patch-vendo-charts.mjs) embeds a rasterizer in the jail that
// answers this message with a PNG of its own document.
function requestJailPng(frame: HTMLIFrameElement): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `exp-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve(null); // unpatched/old jail — export proceeds without this frame
    }, 8000);
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { kind?: string; requestId?: string; dataUrl?: string } | null;
      if (d && d.kind === 'vendo-export-png-result' && d.requestId === requestId) {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve(d.dataUrl || null);
      }
    };
    window.addEventListener('message', onMsg);
    frame.contentWindow?.postMessage({ kind: 'vendo-export-png', requestId }, '*');
  });
}

// Rasterize the rendered app card to a downloadable PNG. Two seams:
// 1. Chart gradient <defs> live in a page-level hidden svg (ensureChartDecor),
//    outside the captured subtree — clone them in so url(#vendo-grad-N) fills
//    survive.
// 2. Each jail iframe is swapped for an <img> of the PNG the jail itself
//    rasterized (requestJailPng) for the duration of the capture.
async function exportCardPng(el: HTMLElement, title?: string): Promise<void> {
  const { toPng } = await import('html-to-image');
  const grad = document.getElementById('vendo-grad-1');
  const svgHost = grad ? (grad as unknown as { ownerSVGElement: SVGSVGElement | null }).ownerSVGElement : null;
  const tmpDefs = svgHost ? (svgHost.cloneNode(true) as SVGSVGElement) : null;
  if (tmpDefs) el.appendChild(tmpDefs);
  const swaps: Array<{ frame: HTMLIFrameElement; img: HTMLImageElement }> = [];
  for (const frame of Array.from(el.querySelectorAll('iframe'))) {
    const dataUrl = await requestJailPng(frame);
    if (!dataUrl) continue;
    const img = document.createElement('img');
    img.src = dataUrl;
    const r = frame.getBoundingClientRect();
    img.style.cssText = `display:block;width:${r.width}px;height:${r.height}px`;
    await img.decode().catch(() => {});
    frame.style.display = 'none';
    frame.parentNode?.insertBefore(img, frame);
    swaps.push({ frame, img });
  }
  try {
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      filter: (node) => !((node as HTMLElement).dataset && 'exportExclude' in (node as HTMLElement).dataset),
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(title || '').replace(/[^\w\- ]+/g, ' ').trim().slice(0, 60) || 'byteflow-app'}.png`;
    a.click();
  } finally {
    tmpDefs?.remove();
    for (const { frame, img } of swaps) {
      img.remove();
      frame.style.display = '';
    }
  }
}

export function VendoAppMessage({ vendoApp }: { vendoApp: VendoAppInfo }) {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    ensureChartDecor();
    let alive = true;
    getWireToken().then(
      (t) => { if (alive) setToken(t); },
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, []);

  const vendoTheme = useMemo(buildVendoTheme, []);
  const cardRef = useRef<HTMLDivElement>(null);
  const client = useMemo(() => {
    if (!token) return null;
    const config = getByteflowConfig();
    return createVendoClient({
      baseUrl: `${config?.apiUrl || ''}/api/vendo`,
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [token]);

  if (failed) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Couldn&apos;t connect to the app service — {vendoApp.title || vendoApp.appId}
      </div>
    );
  }
  if (!client) {
    return (
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" aria-label="Loading app…" />
    );
  }

  const refValue =
    (vendoApp.ref as { kind?: string } | undefined)?.kind === 'vendo/app-ref@1'
      ? (vendoApp.ref as never)
      : ({ kind: 'vendo/app-ref@1', appId: vendoApp.appId, title: vendoApp.title || '' } as never);

  const handleExport = async () => {
    const el = cardRef.current;
    if (!el || exporting) return;
    setExporting(true);
    try {
      await exportCardPng(el, vendoApp.title);
    } catch (e) {
      console.error('[vendo-export] failed:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div ref={cardRef} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        data-export-exclude
        onClick={handleExport}
        disabled={exporting}
        title="Export as image"
        aria-label="Export as image"
        className="absolute right-2 top-2 z-10 rounded-md border border-border/60 bg-card/90 p-1.5 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-60"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </button>
      <VendoProvider client={client} theme={vendoTheme}>
        <VendoAppEmbed refValue={refValue} />
      </VendoProvider>
    </div>
  );
}

export default VendoAppMessage;
