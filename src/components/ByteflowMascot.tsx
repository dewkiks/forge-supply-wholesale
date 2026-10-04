import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * ByteflowMascot — the ByteFlow loading mascot, lightweight edition.
 *
 * Same character as FlowBuilder's preview loader (src/components/ui/ByteFlowMascot.jsx),
 * built to be cheap enough for any "getting ready" state:
 *   - no React state: eye/head offsets are written straight to the DOM;
 *   - the rAF loop only runs while the eyes are easing toward the cursor and
 *     stops once settled, so an idle mascot costs ~0 CPU;
 *   - every other motion (float, blink, and the `working` typing / scanning /
 *     code bits) is a CSS animation on the compositor, no SVG filters;
 *   - honours prefers-reduced-motion (all CSS motion off, eyes snap instead of ease).
 *
 * `working` turns the calm idle loop into a busy one: the hands tap a little
 * keyboard, the eyes scan as if reading code, and code bits drift up. Moving
 * the pointer still makes the eyes follow it; they go back to scanning after
 * a moment of stillness.
 *
 * Keep in sync with packages/byteflow-sdk/src/react/ByteflowMascot.tsx (exported by @byteflow/sdk/react).
 */
export interface ByteflowMascotProps {
  /** Width in px (height is 1.2×). */
  size?: number;
  /** Outline colour. Defaults to the surrounding text colour. */
  color?: string;
  /** Eye colour (also the typing keys and code bits). */
  eyeColor?: string;
  /** Eyes (and a little of the head) follow the pointer. */
  followCursor?: boolean;
  /** Busy loop: typing hands, scanning eyes, rising code bits. */
  working?: boolean;
  /** Accessible label; the mascot is a status indicator. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const CSS = `
.bfm-float{animation:bfm-float 4s ease-in-out infinite}
.bfm-blink{animation:bfm-blink 6s infinite;transform-box:fill-box;transform-origin:center}
.bfm-work .bfm-float{animation:bfm-bob 1.1s ease-in-out infinite}
.bfm-scan{transition:transform .35s ease}
.bfm-work .bfm-scan{animation:bfm-scan 3.2s ease-in-out infinite}
.bfm-work.bfm-look .bfm-scan{animation:none;transform:none}
.bfm-hand-l,.bfm-hand-r{transform-box:fill-box;transform-origin:center}
.bfm-work .bfm-hand-l{animation:bfm-tap .5s ease-in-out infinite}
.bfm-work .bfm-hand-r{animation:bfm-tap .5s ease-in-out .25s infinite}
.bfm-key{opacity:.25}
.bfm-work .bfm-key{animation:bfm-key 1s steps(1) infinite}
.bfm-bit{opacity:0}
.bfm-work .bfm-bit{animation:bfm-bit 2.4s ease-out infinite}
.bfm-glow{opacity:0;transform-box:fill-box;transform-origin:center}
.bfm-work .bfm-glow{animation:bfm-glow 2.4s ease-in-out infinite}
@keyframes bfm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes bfm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes bfm-blink{0%,95%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes bfm-scan{0%,12%{transform:translate(-4px,1px)}38%,50%{transform:translate(4px,1px)}62%{transform:translate(-4px,3px)}88%,100%{transform:translate(-4px,1px)}}
@keyframes bfm-tap{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes bfm-key{0%{opacity:1}30%,100%{opacity:.25}}
@keyframes bfm-bit{0%{opacity:0;transform:translateY(0)}15%{opacity:.9}100%{opacity:0;transform:translateY(-34px)}}
@keyframes bfm-glow{0%,100%{opacity:.08;transform:scale(.9)}50%{opacity:.2;transform:scale(1.05)}}
@media (prefers-reduced-motion:reduce){.bfm-float,.bfm-blink,.bfm-scan,.bfm-hand-l,.bfm-hand-r,.bfm-key,.bfm-bit,.bfm-glow{animation:none!important}}
`;

// Keyboard keys light up in this order (staggered delays make a typing ripple).
const KEYS = [0, 3, 1, 5, 2, 4];
// Code bits: x position, delay (s), glyph.
const BITS: Array<[number, number, string]> = [
  [30, 0, '</>'],
  [70, 0.8, '{ }'],
  [50, 1.6, '01'],
];

export function ByteflowMascot({
  size = 120,
  color = 'currentColor',
  eyeColor = '#3b82f6',
  followCursor = true,
  working = false,
  label = 'Loading',
  className,
  style,
}: ByteflowMascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!followCursor || typeof window === 'undefined') return;
    const svg = svgRef.current;
    const eyes = eyesRef.current;
    const head = headRef.current;
    if (!svg || !eyes || !head) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let frame = 0;
    let idle = 0;

    const paint = () => {
      eyes.setAttribute('transform', `translate(${cur.x.toFixed(2)} ${cur.y.toFixed(2)})`);
      head.setAttribute('transform', `translate(${(cur.x * 0.25).toFixed(2)} ${(cur.y * 0.2).toFixed(2)})`);
    };

    const step = () => {
      cur.x += (target.x - cur.x) * 0.18;
      cur.y += (target.y - cur.y) * 0.18;
      paint();
      if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.05) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
      }
    };

    const ease = () => {
      if (reduced) {
        cur.x = target.x;
        cur.y = target.y;
        paint();
      } else if (!frame) {
        frame = requestAnimationFrame(step);
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(d / 300, 1);
      target.x = (dx / d) * reach * 5;
      target.y = (dy / d) * reach * 4;
      ease();
      // While working, looking at the pointer pauses the scan; after a
      // moment of stillness the eyes recentre and go back to "reading".
      svg.classList.add('bfm-look');
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        svg.classList.remove('bfm-look');
        target.x = 0;
        target.y = 0;
        ease();
      }, 1500);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.clearTimeout(idle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [followCursor]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={label}
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      className={[working ? 'bfm-work' : '', className || ''].join(' ').trim() || undefined}
      style={{ overflow: 'visible', color, ...style }}
    >
      <style>{CSS}</style>
      {/* Soft halo, only while working */}
      <ellipse className="bfm-glow" cx="50" cy="50" rx="46" ry="40" fill={eyeColor} />
      {/* Code bits drifting up from the keyboard */}
      {BITS.map(([x, delay, glyph]) => (
        <text key={glyph} className="bfm-bit" x={x} y="22" textAnchor="middle" fontSize="7"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill={eyeColor}
          style={{ animationDelay: `${delay}s` }}>
          {glyph}
        </text>
      ))}
      <g className="bfm-float" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g ref={headRef}>
          <rect x="15" y="20" width="70" height="55" rx="30" strokeWidth="1.8" />
          <rect x="15" y="20" width="70" height="55" rx="30" fill="currentColor" opacity="0.05" stroke="none" />
          <rect x="22" y="28" width="56" height="38" rx="19" strokeWidth="1" />
          <g ref={eyesRef}>
            <g className="bfm-scan">
              <g className="bfm-blink" fill={eyeColor} stroke="none">
                <rect x="35" y="42" width="10" height="10" rx="1.5" />
                <rect x="55" y="42" width="10" height="10" rx="1.5" />
              </g>
            </g>
          </g>
        </g>
        {working && (
          <g>
            <rect x="20" y="98" width="60" height="9" rx="2.5" strokeWidth="1.2" />
            {KEYS.map((k, i) => (
              <rect key={k} className="bfm-key" x={24 + k * 9} y="101" width="7" height="3" rx="0.8"
                fill={eyeColor} stroke="none" style={{ animationDelay: `${i * 0.17}s` }} />
            ))}
          </g>
        )}
        <circle className="bfm-hand-l" cx="25" cy="90" r="7.5" strokeWidth="1.8" />
        <circle className="bfm-hand-r" cx="75" cy="90" r="7.5" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

export default ByteflowMascot;
