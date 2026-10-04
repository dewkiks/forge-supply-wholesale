import { openChatWidget } from '../../lib/chatBus';
import { SAMPLE_PRODUCTS } from '../../fixtures/products';

export default function ProductShowcase() {
  return (
    <section id="catalog" className="container py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Featured catalog</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Top-reordering SKUs this quarter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sample catalog view — live inventory, pricing and MOQs via the assistant.</p>
        </div>
        <button
          onClick={openChatWidget}
          className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          Ask about full catalog
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SAMPLE_PRODUCTS.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-signature transition hover:-translate-y-0.5"
          >
            <span
              className={[
                'mb-4 h-1.5 w-10 rounded-full',
                p.accent === 'primary' ? 'bg-primary' : 'bg-secondary',
              ].join(' ')}
            />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.category}</p>
            <h3 className="mt-1 font-display text-base font-bold leading-snug">{p.name}</h3>
            <p className="mt-2 flex-1 text-xs text-muted-foreground">{p.blurb}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-bold text-primary">{p.unitPrice}</span>
              <span className="text-xs text-muted-foreground">{p.moq}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
