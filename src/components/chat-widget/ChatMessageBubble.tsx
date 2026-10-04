import { MessageCircleQuestion } from 'lucide-react';
import MarkdownText from '../MarkdownText';
import type { WidgetMessage } from '../../hooks/useChatWidget';

interface Props {
  message: WidgetMessage;
  onChoice?: (questionId: string, choice: string) => void;
  disabled?: boolean;
}

export default function ChatMessageBubble({ message, onChoice, disabled }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        ].join(' ')}
      >
        {message.questionId && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <MessageCircleQuestion className="h-3 w-3" />
            Needs your input
          </div>
        )}
        <MarkdownText className="prose-sm prose-p:my-1 prose-ul:my-1">{message.content}</MarkdownText>

        {message.choices && message.choices.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.choices.map((choice) => (
              <button
                key={choice}
                disabled={disabled}
                onClick={() => onChoice?.(message.questionId!, choice)}
                className="rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                {choice}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
