import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkflowProgress } from './useWorkflowProgress';
import { getInputSchemaFields, onByteflowAuthError } from '../config/byteflow';

export interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  choices?: string[];
  questionId?: string;
}

const GREETING =
  "Hi! I'm the Forge Supply shopping assistant. Ask me about products, bulk pricing, order status, or returns.";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatWidget() {
  const wf = useWorkflowProgress();
  const [messages, setMessages] = useState<WidgetMessage[]>([
    { id: 'greeting', role: 'assistant', content: GREETING, timestamp: Date.now() },
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [authError, setAuthError] = useState<string | null>(null);

  const lastHandledResponse = useRef<string | null>(null);
  const handledQuestionIds = useRef<Set<string>>(new Set());
  const overrideKeyRef = useRef<string | null>(null);

  useEffect(() => onByteflowAuthError((err) => setAuthError(err.userMessage)), []);

  useEffect(() => {
    const field = getInputSchemaFields().find((f) => f.field === 'message');
    overrideKeyRef.current = field ? `${field.nodeId}.${field.field}` : null;
  }, []);

  const appendAssistant = useCallback(
    (content: string, extra?: Partial<WidgetMessage>) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content, timestamp: Date.now(), ...extra },
      ]);
      setUnread((n) => (isOpen ? n : n + 1));
    },
    [isOpen],
  );

  // Final response for the current run — may arrive via wf.responseText or,
  // if extraction failed, via the agent's last streamed "response" message.
  useEffect(() => {
    if (wf.isExecuting) return;
    const streamed = Object.values(wf.agentProgressData)[0]?.messages
      ?.filter((m) => m.type === 'response')
      .at(-1)?.content;
    const text = wf.responseText || streamed;
    if (text && text !== lastHandledResponse.current) {
      lastHandledResponse.current = text;
      appendAssistant(text);
    }
  }, [wf.isExecuting, wf.responseText, wf.agentProgressData, appendAssistant]);

  // Mid-run human-in-the-loop question from the agent.
  useEffect(() => {
    const q = wf.pendingHITLQuestion;
    if (!q || handledQuestionIds.current.has(q.questionId)) return;
    handledQuestionIds.current.add(q.questionId);
    appendAssistant(q.prompt, { questionId: q.questionId, choices: q.choices });
  }, [wf.pendingHITLQuestion, appendAssistant]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: trimmed, timestamp: Date.now() },
      ]);
      const key = overrideKeyRef.current;
      await wf.executeWorkflow(key ? { [key]: trimmed } : undefined);
    },
    [wf],
  );

  const answerQuestion = useCallback(
    async (questionId: string, answer: string) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: answer, timestamp: Date.now() },
      ]);
      await wf.submitHITLAnswer(questionId, answer);
    },
    [wf],
  );

  const openWidget = useCallback(() => {
    setIsOpen(true);
    setUnread(0);
  }, []);

  const agentStatus = Object.values(wf.agentProgressData)[0]?.status;

  return {
    isOpen,
    setIsOpen,
    openWidget,
    unread,
    messages,
    sendMessage,
    answerQuestion,
    isExecuting: wf.isExecuting,
    isConnected: wf.isConnected,
    error: wf.error,
    authError,
    agentStatus,
  };
}
