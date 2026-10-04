import { useState } from 'react';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { openChatWidget } from '../../lib/chatBus';
import { supabase } from '../../config/supabase';

export default function FinalCta() {
  const [submitted, setSubmitted] = useState(false);
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section id="contact" className="container py-16">
      <div className="grid gap-8 rounded-3xl border border-border bg-foreground px-6 py-10 text-background shadow-signature md:grid-cols-2 md:px-12 md:py-14">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Get your wholesale pricing sheet.
          </h2>
          <p className="mt-3 max-w-md text-sm text-background/75">
            Tell us your business name and we'll follow up with tiered pricing for your
            volume. Or skip the form — the AI assistant can start the request right now.
          </p>
          <button
            onClick={openChatWidget}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-background/30 px-4 py-2 text-sm font-semibold transition hover:bg-background/10"
          >
            <MessageCircle className="h-4 w-4" />
            Start with the assistant instead
          </button>
        </div>

        <div className="rounded-2xl bg-background p-5 text-foreground">
          {submitted ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="font-display font-bold">Request received</p>
              <p className="text-sm text-muted-foreground">A wholesale specialist will reach out within one business day.</p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!company.trim() || !email.trim() || submitting) return;
                setSubmitting(true);
                setError(null);
                const { error: insertError } = await supabase
                  .from('wholesale_leads')
                  .insert({ company_name: company.trim(), email: email.trim() });
                setSubmitting(false);
                if (insertError) {
                  setError('Something went wrong — please try again.');
                  return;
                }
                setSubmitted(true);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Business name</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  placeholder="Northpeak Retail"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Work email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Request wholesale pricing'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
