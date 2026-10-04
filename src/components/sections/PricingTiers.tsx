import { Check } from 'lucide-react';
import { PRICING_TIERS } from '../../data/siteContent';

export default function PricingTiers() {
  return (
    <section id="pricing" className="container py-16">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Volume pricing</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Pricing that scales with your orders</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Exact tier and MOQs depend on SKU mix — the assistant can quote your basket live.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3 md:items-center">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.name}
            className={[
              'rounded-2xl border p-6',
              tier.highlighted
                ? 'relative border-primary bg-primary text-primary-foreground shadow-signature md:-translate-y-3 md:py-8'
                : 'border-border bg-card shadow-signature',
            ].join(' ')}
          >
            {tier.highlighted && (
              <span className="absolute -top-3 right-6 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                Most common
              </span>
            )}
            <h3 className="font-display text-lg font-extrabold">{tier.name}</h3>
            <p className={['mt-1 text-xs', tier.highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'].join(' ')}>
              {tier.range}
            </p>
            <p className="mt-3 font-display text-2xl font-extrabold">{tier.discount}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className={['mt-0.5 h-4 w-4 shrink-0', tier.highlighted ? '' : 'text-primary'].join(' ')} />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#contact"
              className={[
                'mt-6 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition',
                tier.highlighted
                  ? 'bg-primary-foreground text-primary hover:brightness-95'
                  : 'border border-border hover:border-primary hover:text-primary',
              ].join(' ')}
            >
              Request this tier
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
