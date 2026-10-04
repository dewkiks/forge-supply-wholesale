import { BadgePercent, Boxes, Headset, LineChart, Tags } from 'lucide-react';
import { BENEFITS } from '../../data/siteContent';

const ICONS = [BadgePercent, Headset, Tags, LineChart, Boxes];

export default function WholesaleBenefits() {
  return (
    <section id="benefits" className="bg-muted/40 py-16">
      <div className="container">
        <div className="mb-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built for wholesale</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            Everything a buying team needs, nothing a shopper doesn't.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {BENEFITS.map((b, i) => {
            const Icon = ICONS[i % ICONS.length];
            const wide = i === 0;
            return (
              <div
                key={b.title}
                className={[
                  'rounded-2xl border border-border bg-card p-5 shadow-signature',
                  wide ? 'md:col-span-2' : 'md:col-span-1',
                  i >= 3 ? 'md:col-span-2' : '',
                ].join(' ')}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-3 font-display text-sm font-bold">{b.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
