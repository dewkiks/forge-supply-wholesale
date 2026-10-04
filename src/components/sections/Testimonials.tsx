import { Quote } from 'lucide-react';
import { TESTIMONIALS } from '../../data/siteContent';

export default function Testimonials() {
  return (
    <section id="reviews" className="bg-muted/40 py-16">
      <div className="container">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">From the buyers</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Retailers who switched their reorders</h2>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-signature">
              <Quote className="h-5 w-5 text-primary/60" />
              <blockquote className="mt-3 text-sm leading-relaxed text-foreground">"{t.quote}"</blockquote>
              <figcaption className="mt-4 text-xs font-semibold text-muted-foreground">
                {t.name} <span className="font-normal">· {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
