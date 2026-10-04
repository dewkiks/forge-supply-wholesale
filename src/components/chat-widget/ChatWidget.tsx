import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { useChatWidget } from '../../hooks/useChatWidget';
import { OPEN_CHAT_EVENT } from '../../lib/chatBus';

export default function ChatWidget() {
  const widget = useChatWidget();
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!widget.isOpen) setShowGreeting(true);
    }, 1800);
    return () => clearTimeout(t);
  }, [widget.isOpen]);

  function open() {
    widget.openWidget();
    setShowGreeting(false);
  }

  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {widget.isOpen && <ChatPanel widget={widget} onClose={() => widget.setIsOpen(false)} />}

      {!widget.isOpen && showGreeting && (
        <div className="relative max-w-[15rem] rounded-2xl rounded-br-sm border border-border bg-card px-4 py-3 text-sm text-foreground shadow-signature">
          <button
            onClick={() => setShowGreeting(false)}
            aria-label="Dismiss"
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="font-display font-semibold">Need a hand? 👋</p>
          <p className="mt-0.5 text-muted-foreground">
            Ask our AI assistant about bulk pricing or your order.
          </p>
          <button
            onClick={open}
            className="mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Start chatting
          </button>
        </div>
      )}

      {!widget.isOpen && (
        <button
          onClick={open}
          aria-label="Open chat assistant"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-signature transition hover:brightness-110"
        >
          <MessageCircle className="h-6 w-6" />
          {widget.unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-bold text-secondary-foreground">
              {widget.unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
