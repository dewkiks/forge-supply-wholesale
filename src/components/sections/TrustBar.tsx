import { TRUST_LOGOS } from '../../data/siteContent';

export default function TrustBar() {
  return (
    <section className="border-y border-border bg-muted/50 py-7">
      <div className="container">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by retail buyers across 48 states
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {TRUST_LOGOS.map((logo) => (
            <span key={logo} className="font-display text-sm font-bold tracking-wide text-muted-foreground/70">
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
