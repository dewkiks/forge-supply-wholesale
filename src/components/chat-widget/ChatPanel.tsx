import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, ShoppingBag, X } from 'lucide-react';
import ChatMessageBubble from './ChatMessageBubble';
import ByteflowMascot from '../ByteflowMascot';
import type { useChatWidget } from '../../hooks/useChatWidget';

type Widget = ReturnType<typeof useChatWidget>;

const QUICK_PROMPTS = ['Bulk pricing tiers', 'Track my order', 'Start a return'];

export default function ChatPanel({ widget, onClose }: { widget: Widget; onClose: () => void }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [widget.messages, widget.isExecuting]);

  function submit(text?: string) {
    const value = (text ?? draft).trim();
    if (!value || widget.isExecuting) return;
    widget.sendMessage(value);
    setDraft('');
  }

  const statusLabel =
    widget.agentStatus === 'using_tool'
      ? 'Checking Shopify…'
      : widget.agentStatus === 'thinking'
        ? 'Thinking…'
        : 'Typing…';

  return (
    <div className="flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-signature sm:w-[24rem]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-bold leading-tight">Forge Assistant</p>
            <p className="text-[11px] leading-tight text-primary-foreground/80">
              {widget.isConnected ? 'Shopify-connected · online' : 'Connecting…'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-full p-1.5 text-primary-foreground/90 transition hover:bg-primary-foreground/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background px-3 py-4">
        {!widget.isConnected && !widget.authError && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-muted-foreground">
            <ByteflowMascot size={64} color="hsl(var(--muted-foreground))" eyeColor="hsl(var(--primary))" />
            Getting the assistant ready…
          </div>
        )}
        {widget.authError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {widget.authError}
          </div>
        )}
        {widget.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {widget.error}
          </div>
        )}
        {widget.messages.map((m) => (
          <ChatMessageBubble
            key={m.id}
            message={m}
            disabled={widget.isExecuting}
            onChoice={(qid, choice) => widget.answerQuestion(qid, choice)}
          />
        ))}
        {widget.isExecuting && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {statusLabel}
          </div>
        )}
      </div>

      {widget.messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-muted/60 px-3 py-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary hover:text-primary"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 border-t border-border bg-card p-2.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about products, orders, returns…"
          disabled={widget.isExecuting || !widget.isConnected}
          className="flex-1 rounded-full border border-input bg-background px-3.5 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || widget.isExecuting || !widget.isConnected}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
