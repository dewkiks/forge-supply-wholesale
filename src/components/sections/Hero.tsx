import { ArrowRight, MessageCircle, ShieldCheck, TrendingDown, Truck } from 'lucide-react';
import { openChatWidget } from '../../lib/chatBus';
import { TRUST_STATS } from '../../data/siteContent';

export default function Hero() {
  return (
    <section id="top" className="container grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:py-20">
      <div className="flex flex-col justify-center">
        <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Verified wholesale buyers only
        </span>
        <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
          Wholesale gear sourcing,
          <span className="text-primary"> without the back-and-forth.</span>
        </h1>
        <p className="mt-5 max-w-lg text-lg text-muted-foreground">
          Tiered bulk pricing, dedicated account managers, and an AI shopping assistant
          that answers order, catalog and return questions instantly — so your buyers
          get decisions, not quote emails.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-signature transition hover:brightness-110"
          >
            Request wholesale pricing
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={openChatWidget}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" />
            Ask the AI assistant
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-primary" /> 2.3-day avg. fulfillment</span>
          <span className="flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-primary" /> Up to 22% off list price</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 self-center sm:gap-4">
        {TRUST_STATS.map((s, i) => (
          <div
            key={s.label}
            className={[
              'rounded-2xl border border-border bg-card p-5 shadow-signature',
              i === 0 ? 'col-span-2' : '',
            ].join(' ')}
          >
            <p className="font-display text-3xl font-extrabold text-primary">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
