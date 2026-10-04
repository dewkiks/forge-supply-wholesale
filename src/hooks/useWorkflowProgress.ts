/**
 * useWorkflowProgress Hook
 *
 * Provides real-time workflow execution progress for generated UIs.
 * Connects to the FlowBuilder WebSocket using a project-specific JWT token.
 *
 * Usage:
 *   const { nodeStates, isExecuting, result, error, executeWorkflow } = useWorkflowProgress();
 *
 * The hook automatically connects when the component mounts and maintains
 * the connection with automatic reconnection on disconnection.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getByteflowConfig, newExecutionId, withExecutionScope, baseChannelOf, extractWorkflowResponse, splitRunInputs, acceptsActionEvent } from '../config/byteflow';
import { createByteflowSocket } from './useByteflowSocket';
import type { Socket } from 'socket.io-client';

// Agent node types that should auto-open the drawer (same as FlowBuilder)
const SPECIALIZED_AGENT_NODE_TYPES = [
  'powerpoint_designer', 'excel_expert', 'pdf_specialist', 'word_document_pro',
  'web_builder', 'testing_engineer', 'mcp_developer', 'visual_artist',
  'canvas_designer', 'gif_creator', 'brand_specialist', 'communications_writer',
  'theme_designer', 'mcp_agent', 'super_agent', 'ai_agent'
];

// Types for workflow events
export interface NodeState {
  status: 'pending' | 'executing' | 'completed' | 'error';
  data?: Record<string, unknown>;
  error?: string;
}

// Message in agent progress (matches AgentProgressDrawer pattern)
export interface AgentMessage {
  type: 'thinking' | 'tool_call' | 'response' | 'tool_result';
  content: string;
  timestamp: number;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

// Todo item from TodoWrite tool
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

// Timeout warning from agent
export interface TimeoutWarning {
  level: 'yellow' | 'red';
  elapsed: number;
  timeout_remaining: number;
  last_tool?: string;
  message: string;
}

// Pending question for human-in-the-loop
export interface PendingQuestion {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
  prompt?: string;
  choices?: string[];
  inputType?: 'multiline' | 'choice' | 'text';
  executionId?: string;
  timestamp: number;
  timeout: number;
}

// Full agent progress data per node (matches AgentProgressDrawer pattern)
export interface AgentProgressData {
  nodeId: string;
  status: 'thinking' | 'using_tool' | 'responding' | 'waiting_for_input' | 'completed' | 'error';
  messages: AgentMessage[];
  todoList?: TodoItem[];
  timeoutWarning?: TimeoutWarning;
  files?: Array<{ path: string; content?: string }>;
  pendingQuestion?: PendingQuestion;
  tokenUsage?: number;
  costEstimate?: number;
  elapsedTime?: number;
  currentTool?: string;
  mcpServers?: string[];
  agentType?: string;
}

// Legacy single-node agentProgress interface for backward compatibility
export interface AgentProgress {
  nodeId: string;
  thinking?: string;
  messageChunk?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface WorkflowResult {
  success: boolean;
  outputs: Record<string, unknown>;
  error?: string;
}

// Chat message for chatbot UI (when workflow has chat_trigger)
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Present when the agent built a vendo app for this turn (vendo_app event).
   *  Render with <VendoAppMessage vendoApp={msg.vendoApp} /> — see
   *  components/VendoAppMessage.tsx. */
  vendoApp?: { appId: string; title?: string; ref?: unknown };
}

// Helper to get storage key for this workflow
function getStorageKey(workflowId: string, key: string): string {
  return `byteflow_execution_${workflowId}_${key}`;
}

// Helper to load persisted state from sessionStorage
function loadPersistedState<T>(workflowId: string, key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(getStorageKey(workflowId, key));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`Failed to load persisted state for ${key}:`, e);
  }
  return defaultValue;
}

// Helper to save state to sessionStorage
function savePersistedState<T>(workflowId: string, key: string, value: T): void {
  try {
    sessionStorage.setItem(getStorageKey(workflowId, key), JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save persisted state for ${key}:`, e);
  }
}

export function useWorkflowProgress(configOverride?: Partial<ReturnType<typeof getByteflowConfig>> & { channelId?: string }) {
  const baseConfig = getByteflowConfig();
  // Stable across re-renders unless configOverride's CONTENT actually changes.
  // getByteflowConfig() isn't memoized and callers often pass configOverride as
  // an inline object literal, so without this `config` got a brand new identity
  // every render — which fed connect()'s useCallback([config]) below, tearing
  // down and re-registering the shared socket's onAny listener on every render,
  // including every render an incoming stream chunk itself triggered.
  const configOverrideKey = configOverride ? JSON.stringify(configOverride) : '';
  const config = useMemo(
    () => (configOverride ? { ...baseConfig, ...configOverride } : baseConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseConfig's CONTENT
    // is static build-injected config; only its object reference is unstable per
    // getByteflowConfig() call. configOverrideKey is what actually decides when
    // this must rebuild.
    [configOverrideKey]
  );
  // Use channelId as persistence key if provided (unique per card), otherwise workflowId
  const workflowId = (config as any)?.channelId || config?.workflowId || 'default';

  // Initialize state from sessionStorage to persist across page reloads
  const [isConnected, setIsConnected] = useState(false);
  // Persist isExecuting per channelId so header dropdown panels sync with real card panels
  const [isExecuting, setIsExecuting] = useState(() =>
    loadPersistedState(workflowId, 'isExecuting', false)
  );
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>(() =>
    loadPersistedState(workflowId, 'nodeStates', {})
  );
  const [agentProgress, setAgentProgress] = useState<AgentProgress | null>(null);
  // NEW: Per-node agent progress data with message accumulation (matches AgentProgressDrawer pattern)
  const [agentProgressData, setAgentProgressData] = useState<Record<string, AgentProgressData>>(() =>
    loadPersistedState(workflowId, 'agentProgressData', {})
  );
  const [result, setResult] = useState<WorkflowResult | null>(() =>
    loadPersistedState(workflowId, 'result', null)
  );
  const [error, setError] = useState<string | null>(() =>
    loadPersistedState(workflowId, 'error', null)
  );
  // Auto-open agent drawer for agent nodes (same as FlowBuilder)
  const [autoOpenAgentNodeId, setAutoOpenAgentNodeId] = useState<string | null>(null);

  // Chat state for chatbot UI (when workflow has chat_trigger)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadPersistedState(workflowId, 'chatMessages', [])
  );
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Persist state changes to sessionStorage
  useEffect(() => {
    savePersistedState(workflowId, 'isExecuting', isExecuting);
  }, [workflowId, isExecuting]);

  useEffect(() => {
    savePersistedState(workflowId, 'nodeStates', nodeStates);
  }, [workflowId, nodeStates]);

  useEffect(() => {
    savePersistedState(workflowId, 'agentProgressData', agentProgressData);
  }, [workflowId, agentProgressData]);

  useEffect(() => {
    savePersistedState(workflowId, 'result', result);
  }, [workflowId, result]);

  useEffect(() => {
    savePersistedState(workflowId, 'error', error);
  }, [workflowId, error]);

  useEffect(() => {
    savePersistedState(workflowId, 'chatMessages', chatMessages);
  }, [workflowId, chatMessages]);

  const socketRef = useRef<Socket | null>(null);
  const chatTimeoutRef = useRef<number | null>(null);  // Track chat response timeout

  // Stable channel ID that matches the WebSocket registration in ui_websocket.py
  // The WebSocket endpoint uses: resolved_channel_id = channel_id or f"ui_{project_id}"
  // So we must use the same format to receive HITL questions and other events
  const channelIdRef = useRef<string | null>(null);
  if (channelIdRef.current === null) {
    // Use configOverride.channelId if provided (for per-card isolated workflows),
    // otherwise use project-based channel ID
    const projectId = config?.projectId || 'default';
    channelIdRef.current = (config as any)?.channelId || `ui_${projectId}`;
  }

  // The execution id of the run this hook is currently tracking. UI GEN 2.0
  // routes each run on its own execution id so concurrent runs — or a stale
  // previous run — don't cross-talk: incoming events are filtered against it.
  // Persisted so a page reload can still match the in-flight run's events.
  const currentExecutionIdRef = useRef<string | null>(
    loadPersistedState<string | null>(workflowId, 'currentExecutionId', null)
  );

  // Connect via Socket.IO (auto-reconnect, heartbeat, token refresh handled by createByteflowSocket)
  // Ref-based handler — avoids "can't access before initialization" error
  // (connect is defined before handleMessage, but needs to call it)
  const handleMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {});

  // Connect via Socket.IO (auto-reconnect, heartbeat, token refresh handled by createByteflowSocket)
  const connect = useCallback(() => {
    if (!config) return;

    // Get or create the shared singleton socket
    const socket = createByteflowSocket();
    socketRef.current = socket;

    // Always add OUR listeners (each hook instance needs its own)
    // Store handler references so we can remove only OUR listeners on cleanup
    const onConnect = () => {
      setIsConnected(true);
      setError(null);
    };
    const onDisconnect = () => {
      setIsConnected(false);
    };
    const onAnyEvent = (eventName: string, data: any) => {
      handleMessageRef.current({ type: eventName, ...(data || {}) });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.onAny(onAnyEvent);

    // Store refs for cleanup
    (socketRef as any)._onConnect = onConnect;
    (socketRef as any)._onDisconnect = onDisconnect;
    (socketRef as any)._onAnyEvent = onAnyEvent;

    // If already connected, sync state immediately
    if (socket.connected) {
      setIsConnected(true);
    }
  }, [config]);

  // Handle incoming messages
  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const msgType = data.type as string;

    // Channel filtering: per-card panels only process events matching their channelId.
    // Header panel (channelId = "ui_{projectId}") processes ALL events.
    // Events carry a per-execution channel ("{base}~exec~{id}"); compare on the
    // base portion so per-card routing is unaffected by the execution suffix.
    const myChannel = channelIdRef.current || '';
    const eventChannel = baseChannelOf((data.channel_id as string) || '');
    const defaultChannel = `ui_${(config as any)?.projectId || ''}`;
    const isDefaultChannel = myChannel === defaultChannel;

    // If this is a per-card panel (custom channelId, not the default),
    // only process events that match our specific channel
    if (!isDefaultChannel && eventChannel && eventChannel !== myChannel) {
      return; // Event is for a different card — skip
    }

    // Per-execution filtering (UI GEN 2.0): once this hook is tracking a run,
    // ignore events stamped with a different execution id — a concurrent run,
    // or a stale previous run. Events with no execution id (e.g. 'connected')
    // and the initial state before any run are never filtered.
    const myExecutionId = currentExecutionIdRef.current;
    const eventExecutionId = ((data.execution_id || data.executionId) as string) || '';
    if (!acceptsActionEvent(myChannel, myExecutionId, data)) return;
    if (myExecutionId && eventExecutionId && eventExecutionId !== myExecutionId) {
      return; // Event belongs to a different run — skip
    }

    switch (msgType) {
      case 'connected':
        console.log('Connected to workflow:', data.workflowId);
        break;

      case 'project_deleted':
        // Project has been deleted from the backend - stop reconnecting permanently
        console.warn('⚠️ Project not found or deleted:', data.projectId);
        // Disconnect Socket.IO — explicit disconnect prevents auto-reconnect
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        setError(
          'This app can no longer connect to the backend. ' +
          'The project may have been deleted from FlowBuilder. ' +
          'Please contact the app administrator.'
        );
        break;

      case 'execute_workflow_ack':
        console.log('Workflow execution acknowledged:', data.workflowId);
        break;

      // Support both underscore and dot notation for compatibility
      case 'workflow_started':
      case 'workflow.started':
        setIsExecuting(true);
        setResult(null);
        setNodeStates({});
        break;

      case 'workflow_node_started':
      case 'workflow.node_started':
      case 'node_started':
        {
          const nodeId = (data.node_id || data.nodeId) as string;
          const nodeType = data.node_type as string;

          setNodeStates((prev) => ({
            ...prev,
            [nodeId]: { status: 'executing' },
          }));

          // Auto-open drawer for agent node types (same as FlowBuilder)
          if (nodeType && SPECIALIZED_AGENT_NODE_TYPES.includes(nodeType)) {
            console.log('🚀 [useWorkflowProgress] Agent node started, auto-opening drawer:', nodeId, nodeType);
            setAutoOpenAgentNodeId(nodeId);
            // Pre-initialize agent progress data
            setAgentProgressData(prev => ({
              ...prev,
              [nodeId]: {
                nodeId,
                status: 'thinking',
                messages: [],
                mcpServers: [],
                agentType: nodeType,
                files: []
              }
            }));
          }
        }
        break;

      case 'workflow_node_completed':
      case 'workflow.node_completed':
      case 'node_completed':
        // CRITICAL: Files are in data.files, not data.result.files!
        // Backend sends: { type: 'node_completed', nodeId, result, files, status, metadata }
        setNodeStates((prev) => ({
          ...prev,
          [data.nodeId as string]: {
            status: 'completed',
            data: {
              ...(data.data || data.result) as Record<string, unknown>,
              // Extract files from both possible locations
              files: data.files || (data.result as any)?.files || (data.data as any)?.files || [],
              status: data.status,
              metadata: data.metadata,
            },
          },
        }));
        break;

      case 'workflow_node_error':
      case 'workflow.node_error':
      case 'node_error':
        setNodeStates((prev) => ({
          ...prev,
          [data.nodeId as string]: {
            status: 'error',
            error: data.error as string,
          },
        }));
        break;

      case 'workflow_completed':
      case 'workflow.completed':
        setIsExecuting(false);
        executionInFlightRef.current = false;  // Allow new executions
        // Clear chat timeout since workflow completed
        if (chatTimeoutRef.current) {
          clearTimeout(chatTimeoutRef.current);
          chatTimeoutRef.current = null;
        }
        // CRITICAL: Reset chat loading state as fallback
        // This ensures UI doesn't stay stuck if chat_response was never sent
        setIsChatLoading(false);
        // Mark all nodes that are still 'executing' as 'completed'
        // This fixes the "stuck on last node" issue when workflow_completed arrives
        setNodeStates((prev) => {
          const updated = { ...prev };
          for (const nodeId of Object.keys(updated)) {
            if (updated[nodeId].status === 'executing') {
              updated[nodeId] = { ...updated[nodeId], status: 'completed' };
            }
          }
          return updated;
        });
        // Set result - aggregate outputs from nodeStates if not provided in event
        {
          const eventOutputs = (data.result || data.data || data.outputs) as Record<string, unknown>;
          if (eventOutputs && Object.keys(eventOutputs).length > 0) {
            setResult({
              success: true,
              outputs: eventOutputs,
            });
          } else {
            // Need to read nodeStates synchronously - use a callback that returns the aggregated data
            setNodeStates((prev) => {
              const aggregatedOutputs: Record<string, unknown> = {};
              for (const [nodeId, state] of Object.entries(prev)) {
                if (state.status === 'completed' && state.data) {
                  aggregatedOutputs[nodeId] = state.data;
                }
              }
              // Set result after aggregating (outside callback to avoid issues)
              setTimeout(() => {
                setResult({
                  success: true,
                  outputs: aggregatedOutputs,
                });
              }, 0);
              return prev; // Don't modify state, just read
            });
          }
        }
        break;

      case 'workflow_error':
      case 'workflow.error':
        setIsExecuting(false);
        executionInFlightRef.current = false;  // Allow new executions
        // Clear chat timeout since workflow errored
        if (chatTimeoutRef.current) {
          clearTimeout(chatTimeoutRef.current);
          chatTimeoutRef.current = null;
        }
        // CRITICAL: Reset chat loading state on error
        // This ensures UI doesn't stay stuck if workflow fails
        setIsChatLoading(false);
        setResult({
          success: false,
          outputs: {},
          error: (data.error || data.message) as string,
        });
        break;

      case 'agent_started':
      case 'agent.started':
        {
          const nodeId = (data.node_id || data.nodeId) as string;
          const agentType = data.agent_type as string;
          console.log('🤖 [useWorkflowProgress] agent_started:', { nodeId, agentType });

          // Initialize agent progress with empty messages array
          setAgentProgressData(prev => ({
            ...prev,
            [nodeId]: {
              nodeId,
              status: 'thinking',
              messages: [],
              mcpServers: (data.mcp_servers || data.mcpServers) as string[] || [],
              agentType,
              elapsedTime: 0,
            }
          }));
          // Also mark node as executing
          setNodeStates(prev => ({
            ...prev,
            [nodeId]: { status: 'executing' }
          }));

          // Fallback auto-open: if no drawer is open yet, open for this agent
          setAutoOpenAgentNodeId(prev => {
            if (!prev) {
              console.log('🚀 [useWorkflowProgress] Agent started (fallback), auto-opening drawer:', nodeId);
              return nodeId;
            }
            return prev;
          });
        }
        break;

      case 'agent_thinking':
      case 'agent.thinking':
        // Legacy support - still update the old agentProgress
        setAgentProgress({
          nodeId: data.nodeId as string,
          thinking: data.content as string,
        });
        // NEW: Also update agentProgressData with thinking message
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'thinking', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'thinking',
              messages: [
                ...current.messages,
                {
                  type: 'thinking' as const,
                  content: data.content as string,
                  timestamp: Date.now(),
                }
              ]
            }
          };
        });
        break;

      case 'agent_message_chunk':
      case 'agent.message_chunk':
        console.log('💬 [useWorkflowProgress] agent_message_chunk:', { nodeId: data.node_id || data.nodeId, contentLen: (data.content as string)?.length });
        // Legacy support
        setAgentProgress((prev) =>
          prev
            ? { ...prev, messageChunk: (prev.messageChunk || '') + (data.content as string) }
            : { nodeId: data.nodeId as string, messageChunk: data.content as string }
        );
        // NEW: Accumulate message chunks (matches AgentProgressDrawer pattern)
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'responding', messages: [] };
          const messages = [...current.messages];

          // Find last response message and append, or create new
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.type === 'response') {
            messages[messages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + (data.content as string),
              timestamp: Date.now(),
            };
          } else {
            messages.push({
              type: 'response' as const,
              content: data.content as string,
              timestamp: Date.now(),
            });
          }

          return {
            ...prev,
            [nodeId]: { ...current, messages, status: 'responding' }
          };
        });
        break;

      case 'agent_tool_started':
      case 'agent.tool_started':
        console.log('🔧 [useWorkflowProgress] agent_tool_started:', { nodeId: data.node_id || data.nodeId, tool: data.tool_name || data.toolName });
        // Legacy support
        setAgentProgress({
          nodeId: data.nodeId as string,
          toolCall: {
            name: (data.toolName || data.tool_name) as string,
            arguments: (data.arguments || data.tool_input) as Record<string, unknown> || {},
          },
        });

        // NEW: Add tool call to messages array and extract TodoWrite todos
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'using_tool', messages: [] };
          const toolName = (data.tool_name || data.toolName) as string;
          const toolInput = (data.tool_input || data.arguments) as Record<string, unknown> || {};

          // Extract TodoWrite todos
          let todoList = current.todoList || [];
          if (toolName === 'TodoWrite' && (toolInput as any)?.todos) {
            todoList = (toolInput as any).todos;
          }

          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'using_tool',
              currentTool: toolName,
              todoList,
              messages: [
                ...current.messages,
                {
                  type: 'tool_call' as const,
                  content: `Calling ${toolName}`,
                  timestamp: Date.now(),
                  tool_name: toolName,
                  tool_input: toolInput,
                }
              ]
            }
          };
        });

        // Also store tool calls in node state for backward compatibility
        setNodeStates((prev) => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const currentNode = prev[nodeId] || { status: 'executing', data: {} };
          const toolCalls = (currentNode.data?.toolCalls || []) as Array<unknown>;

          return {
            ...prev,
            [nodeId]: {
              ...currentNode,
              data: {
                ...currentNode.data,
                toolCalls: [
                  ...toolCalls,
                  {
                    name: (data.toolName || data.tool_name) as string,
                    input: (data.arguments || data.tool_input) as Record<string, unknown> || {},
                    timestamp: new Date().toISOString(),
                  },
                ],
              },
            },
          };
        });
        break;

      case 'agent_tool_result':
      case 'agent.tool_result':
        // Add tool result to messages
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'responding', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'responding',
              currentTool: undefined,
              messages: [
                ...current.messages,
                {
                  type: 'tool_result' as const,
                  content: data.result as string || JSON.stringify(data.result),
                  timestamp: Date.now(),
                  tool_name: (data.tool_name || data.toolName) as string,
                }
              ]
            }
          };
        });
        break;

      case 'agent_timeout_warning':
      case 'agent.timeout_warning':
        // Store timeout warning
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'thinking', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              timeoutWarning: {
                level: data.level as 'yellow' | 'red',
                elapsed: data.elapsed as number,
                timeout_remaining: data.timeout_remaining as number,
                last_tool: data.last_tool as string,
                message: data.message as string,
              }
            }
          };
        });
        break;

      case 'agent_question':
      case 'agent.question':
        // Human-in-the-loop question from AskUserQuestion tool
        console.log('❓ Agent question:', data);
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'waiting_for_input', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'waiting_for_input',
              pendingQuestion: {
                questions: (data.question as any)?.questions || [],
                executionId: data.execution_id as string,
                timestamp: Date.now(),
                timeout: (data.timeout as number) || 600,
              }
            }
          };
        });
        break;

      case 'hitl_question':
        // Human-in-the-loop from MCP server
        console.log('🤚 HITL Question from MCP server:', data);
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string ||
            Object.keys(prev).find(key => prev[key]?.status === 'thinking' || prev[key]?.status === 'using_tool');

          if (!nodeId) {
            console.warn('⚠️ HITL question received but no active agent node found');
            return prev;
          }

          const current = prev[nodeId] || { nodeId, status: 'waiting_for_input', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'waiting_for_input',
              pendingQuestion: {
                prompt: data.prompt as string,
                choices: data.choices as string[],
                inputType: data.input_type as 'multiline' | 'choice' | 'text',
                // Backend sends question_id, not execution_id
                executionId: (data.question_id || data.execution_id) as string,
                timestamp: Date.now(),
                timeout: (data.timeout as number) || 600,
              }
            }
          };
        });
        break;

      case 'agent_completed':
      case 'agent.completed':
        // Mark agent as completed in agentProgressData
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'completed', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: 'completed',
              tokenUsage: (data.token_usage || data.tokenUsage) as number,
              costEstimate: (data.cost_estimate || data.costEstimate) as number,
              pendingQuestion: undefined,
              timeoutWarning: undefined,
            }
          };
        });
        // Store token usage and cost in node state
        setNodeStates((prev) => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const currentNode = prev[nodeId] || { status: 'completed', data: {} };

          return {
            ...prev,
            [nodeId]: {
              ...currentNode,
              status: 'completed',
              data: {
                ...currentNode.data,
                tokenUsage: data.token_usage || data.tokenUsage,
                costEstimate: data.cost_estimate || data.costEstimate,
              },
            },
          };
        });
        break;

      case 'agent_status_update':
      case 'agent.status_update':
        // Update agent status
        setAgentProgressData(prev => {
          const nodeId = (data.node_id || data.nodeId) as string;
          const current = prev[nodeId] || { nodeId, status: 'thinking', messages: [] };
          return {
            ...prev,
            [nodeId]: {
              ...current,
              status: data.status as AgentProgressData['status'],
              currentTool: data.current_tool as string,
              elapsedTime: data.elapsed_time as number,
            }
          };
        });
        break;

      case 'execution':
        // Temporal workflow execution events (used by voice agent and other Temporal executions)
        const event = data.event as string;
        const nodeId = data.node_id as string;

        if (event === 'started') {
          // Workflow started via Temporal
          setIsExecuting(true);
          setResult(null);
          setNodeStates({});
          console.log('🚀 Temporal workflow started');
        } else if (event === 'node_started') {
          // Node started via Temporal
          setNodeStates((prev) => ({
            ...prev,
            [nodeId]: { status: 'executing' },
          }));
          console.log(`📍 Temporal node started: ${data.node_label || nodeId}`);
        } else if (event === 'node_completed') {
          // Node completed via Temporal
          setNodeStates((prev) => ({
            ...prev,
            [nodeId]: {
              status: 'completed',
              data: {
                ...(data.data || data.result) as Record<string, unknown>,
                // Extract files from Temporal execution too
                files: data.files || (data.result as any)?.files || (data.data as any)?.files || [],
                status: data.status,
                metadata: data.metadata,
              },
            },
          }));
          console.log(`✅ Temporal node completed: ${data.node_label || nodeId}`);
        } else if (event === 'failed') {
          // Workflow failed via Temporal
          setIsExecuting(false);
          executionInFlightRef.current = false;  // Allow new executions
          setResult({
            success: false,
            outputs: {},
            error: data.error as string,
          });
          console.error(`❌ Temporal workflow failed: ${data.error}`);
        }
        break;

      case 'chat_response':
        // Chat response from AI agent in chat mode
        // This is sent when workflow has chat_trigger and is_chat_mode=true
        {
          const content = data.content as string;
          const msgWorkflowId = data.workflow_id as string;

          console.log('💬 [useWorkflowProgress] chat_response received:', { content: content?.slice(0, 100), workflow_id: msgWorkflowId });

          // Clear the chat timeout since we received a response
          if (chatTimeoutRef.current) {
            clearTimeout(chatTimeoutRef.current);
            chatTimeoutRef.current = null;
          }

          // ALWAYS reset loading state when chat_response arrives, even if content is empty
          // This prevents the UI from being stuck in "thinking" state
          setIsChatLoading(false);

          if (content) {
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: 'assistant',
              content,
              timestamp: Date.now(),
            };
            setChatMessages(prev => [...prev, assistantMessage]);
          } else {
            // Log warning but don't leave UI stuck
            console.warn('💬 [useWorkflowProgress] chat_response received with empty content');
          }
        }
        break;

      case 'vendo_app':
        // Generative UI: the agent called vendo_create_app — a live micro-app
        // was built for this turn. Appended as its own assistant message;
        // chat_response (if any) arrives separately as plain text.
        {
          const appId = data.app_id as string;
          if (!appId) break;
          const vendoMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: (data.title as string) || 'Generated app',
            vendoApp: { appId, title: data.title as string, ref: data.ref },
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, vendoMessage]);
        }
        break;

      case 'no_cached_result':
        // Server has no cached result — if we thought we were executing, the workflow ended
        // and we missed the completion event. Clear stale state.
        if (isExecuting) {
          console.warn('[useWorkflowProgress] No cached result but isExecuting=true — clearing stale state');
          setIsExecuting(false);
          executionInFlightRef.current = false;
          setResult({
            success: true,
            outputs: {},
            error: undefined,
          });
        }
        break;

      case 'workflow_terminated':
        // Workflow was terminated — clear execution state
        console.log('🛑 [useWorkflowProgress] Workflow terminated');
        setIsExecuting(false);
        executionInFlightRef.current = false;
        setResult({
          success: false,
          outputs: {},
          error: 'Workflow was terminated',
        });
        break;

      default:
        // Don't log pong or common events
        if (!['pong', 'ready', 'edge_activated'].includes(msgType)) {
          console.debug('Unhandled message type:', msgType, data);
        }
    }
  }, [isExecuting]);

  // Keep handleMessageRef in sync with latest handleMessage
  handleMessageRef.current = handleMessage;

  // Ref to track in-flight execution to prevent double execution
  const executionInFlightRef = useRef(false);

  // Join this run's dedicated Socket.IO room (UI GEN 2.0 per-run isolation).
  // Resolves on the server's `execution_joined` ack, or after a short timeout
  // so a missing ack never blocks the run (the early-event buffer covers any
  // gap, and the client also re-joins on reconnect).
  const joinExecutionRoom = useCallback((executionId: string): Promise<void> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        socket.off('execution_joined', onJoined);
        resolve();
      };
      const onJoined = (data: any) => {
        if (data && (data.executionId === executionId)) finish();
      };
      socket.on('execution_joined', onJoined);
      socket.emit('join_execution', { executionId });
      setTimeout(finish, 1500);
    });
  }, []);

  // Headers for the public execute/terminate endpoints. Sends the embedded
  // ByteFlow API key as a Bearer token so the backend can authenticate the
  // request and confirm workflow ownership (UI GEN 2.0 fix #2).
  const buildExecuteHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = (config as any)?.apiKey;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return headers;
  }, [config]);

  // Execute workflow via HTTP POST to public endpoint
  // This endpoint supports parameter_overrides and routes updates via channel_id to WebSocket
  const executeWorkflow = useCallback(
    async (parameterOverrides?: Record<string, unknown>, inputData?: Record<string, unknown>) => {
      if (!config) {
        setError('No workflow configuration available');
        return;
      }

      // Prevent double execution
      if (executionInFlightRef.current) {
        console.warn('⚠️ [useWorkflowProgress] Execution already in flight, ignoring duplicate call');
        return;
      }
      executionInFlightRef.current = true;

      // Fresh execution id for this run — streamed events are filtered against it.
      const executionId = newExecutionId();
      currentExecutionIdRef.current = executionId;
      savePersistedState(workflowId, 'currentExecutionId', executionId);

      // Reset state for new execution
      setIsExecuting(true);
      setError(null);
      setResult(null);
      setNodeStates({});
      setAgentProgress(null);
      setAgentProgressData({});
      setAutoOpenAgentNodeId(null);  // Reset auto-open for new execution

      try {
        // Per-run isolation (UI GEN 2.0): JOIN this run's dedicated Socket.IO
        // room BEFORE starting it, so we only ever receive frames for runs we
        // started. The per-execution channel makes every streamed event (incl.
        // handler/agent events) route to that room.
        const baseChannel = channelIdRef.current || `ui_${(config as any)?.projectId || ''}`;
        const execChannel = withExecutionScope(baseChannel, executionId);
        await joinExecutionRoom(executionId);

        // HTTP POST to public execution endpoint (supports parameter_overrides)
        // Real-time updates come via WebSocket using the per-execution channel
        // Trigger fields (e.g. a manual_trigger "message") must go to input_data,
        // NOT parameter_overrides (which only patches saved node config) — otherwise
        // they're silently dropped and the run uses the workflow's saved default.
        // splitRunInputs routes them, so a run form can pass everything as the first
        // arg and it still reaches the backend. Any explicit inputData merges on top.
        const routed = splitRunInputs(parameterOverrides || {}, inputData || {}, config.workflowId, config);
        const payload = {
          parameter_overrides: routed.parameterOverrides,
          input_data: routed.inputData,
          channel_id: execChannel,   // Links HTTP to WebSocket (per-execution room)!
          execution_id: executionId, // Per-run channel routing (UI GEN 2.0)
        };
        console.log('🚀 [useWorkflowProgress] executeWorkflow →', { parameter_overrides: routed.parameterOverrides, input_data: routed.inputData });
        console.log('🚀 [useWorkflowProgress] Endpoint:', `${config.apiUrl}/workflows/public/${config.workflowId}/execute`);

        const response = await fetch(
          `${config.apiUrl}/workflows/public/${config.workflowId}/execute`,
          {
            method: 'POST',
            headers: buildExecuteHeaders(),
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Execution failed: ${response.statusText}`);
        }

        console.log('Workflow execution requested via HTTP POST');
        // Note: Real-time updates will come via WebSocket, final result via workflow_completed event
      } catch (err) {
        console.error('Workflow execution failed:', err);
        setError(err instanceof Error ? err.message : 'Execution failed');
        setIsExecuting(false);
        executionInFlightRef.current = false;  // Allow retry on error
      }
    },
    [config, joinExecutionRoom, buildExecuteHeaders, workflowId]
  );

  // Send chat message to workflow with chat_trigger
  // This triggers workflow execution in chat mode and waits for chat_response via WebSocket
  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!config) {
        setError('No workflow configuration available');
        return;
      }

      if (!message.trim()) {
        return;
      }

      // Clear any existing chat timeout
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
        chatTimeoutRef.current = null;
      }

      // Add user message to chat immediately
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, userMessage]);
      setIsChatLoading(true);
      setError(null);

      // Set timeout to auto-reset loading state if no response within 2 minutes
      // This is a safety net in case chat_response event is never received
      chatTimeoutRef.current = window.setTimeout(() => {
        console.warn('⚠️ [useWorkflowProgress] Chat response timeout - resetting loading state');
        setIsChatLoading(false);
        setError('Response took too long. The workflow may still be processing.');
      }, 300000); // 5 minutes — agent runs with tool use routinely take 2-4 min

      try {
        // Fresh execution id for this chat turn — events are filtered against it.
        const executionId = newExecutionId();
        currentExecutionIdRef.current = executionId;
        savePersistedState(workflowId, 'currentExecutionId', executionId);

        // Per-run isolation: join this turn's room before sending, and route
        // events on a per-execution channel.
        const baseChannel = channelIdRef.current || `ui_${(config as any)?.projectId || ''}`;
        const execChannel = withExecutionScope(baseChannel, executionId);
        await joinExecutionRoom(executionId);

        // Execute workflow with chat message as input
        // The backend will set is_chat_mode=true when it detects chatMessage in input_data
        const payload = {
          parameter_overrides: {},
          input_data: {
            chatMessage: message.trim(),
            is_chat_mode: true,  // Enable chat mode to get chat_response events
          },
          channel_id: execChannel,
          execution_id: executionId,        // Per-run channel routing (UI GEN 2.0)
        };

        console.log('💬 [useWorkflowProgress] sendChatMessage:', message.slice(0, 50));

        const response = await fetch(
          `${config.apiUrl}/workflows/public/${config.workflowId}/execute`,
          {
            method: 'POST',
            headers: buildExecuteHeaders(),
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Chat execution failed: ${response.statusText}`);
        }

        console.log('💬 Chat message sent, waiting for response via WebSocket');
        // Response will arrive via chat_response WebSocket event
      } catch (err) {
        console.error('Chat message failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
        setIsChatLoading(false);
        // Clear timeout on error
        if (chatTimeoutRef.current) {
          clearTimeout(chatTimeoutRef.current);
          chatTimeoutRef.current = null;
        }
      }
    },
    [config, joinExecutionRoom, buildExecuteHeaders, workflowId]
  );

  // Clear chat messages
  const clearChatMessages = useCallback(() => {
    setChatMessages([]);
    sessionStorage.removeItem(getStorageKey(workflowId, 'chatMessages'));
  }, [workflowId]);

  // Terminate/stop running workflow execution
  const terminateWorkflow = useCallback(async () => {
    if (!config) {
      console.warn('No config available for terminate');
      return;
    }

    // Terminate only THIS run (UI GEN 2.0): pass the current execution id so a
    // Stop click can't kill another user's concurrent run of the same workflow.
    const executionId = currentExecutionIdRef.current;
    console.log('🛑 [useWorkflowProgress] Terminating workflow:', config.workflowId, 'execution:', executionId);

    try {
      const url = new URL(`${config.apiUrl}/workflows/public/${config.workflowId}/terminate`);
      if (executionId) url.searchParams.set('execution_id', executionId);
      const response = await fetch(
        url.toString(),
        {
          method: 'POST',
          headers: buildExecuteHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Terminate failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🛑 Workflow terminated:', result);

      // Leave the per-execution room now that this run is done.
      if (executionId && socketRef.current) {
        socketRef.current.emit('leave_execution', { executionId });
      }

      // Reset execution state
      setIsExecuting(false);
      setIsChatLoading(false);
      executionInFlightRef.current = false;

      return result;
    } catch (err) {
      console.error('Failed to terminate workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to terminate');
    }
  }, [config, buildExecuteHeaders]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Remove only OUR listeners — other useWorkflowProgress instances share the singleton socket
    if (socketRef.current) {
      const s = socketRef as any;
      if (s._onConnect) socketRef.current.off('connect', s._onConnect);
      if (s._onDisconnect) socketRef.current.off('disconnect', s._onDisconnect);
      if (s._onAnyEvent) socketRef.current.offAny(s._onAnyEvent);
      socketRef.current = null;
    }
    if (chatTimeoutRef.current) {
      clearTimeout(chatTimeoutRef.current);
      chatTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Reset auto-open state (call when drawer is closed)
  const resetAutoOpen = useCallback(() => {
    setAutoOpenAgentNodeId(null);
  }, []);

  // Clear all persisted execution state (for starting fresh)
  const clearExecutionState = useCallback(() => {
    setIsExecuting(false);
    setNodeStates({});
    setAgentProgressData({});
    setResult(null);
    setError(null);
    setAgentProgress(null);
    setAutoOpenAgentNodeId(null);
    setChatMessages([]);
    setIsChatLoading(false);
    currentExecutionIdRef.current = null;
    // Clear from sessionStorage
    sessionStorage.removeItem(getStorageKey(workflowId, 'isExecuting'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'nodeStates'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'agentProgressData'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'result'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'error'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'chatMessages'));
    sessionStorage.removeItem(getStorageKey(workflowId, 'currentExecutionId'));
  }, [workflowId]);

  // Submit HITL answer via HTTP POST
  const submitHITLAnswer = useCallback(async (questionId: string, answer: string) => {
    if (!config) return;

    console.log('📤 Submitting HITL answer:', { questionId, answer });

    try {
      const response = await fetch(
        `${config.apiUrl}/mcp/hitl/answer/${questionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer }),
        }
      );

      if (response.ok) {
        console.log('✅ HITL answer submitted successfully');
        // Clear pending question from agentProgressData
        setAgentProgressData(prev => {
          const updated = { ...prev };
          for (const nodeId of Object.keys(updated)) {
            if (updated[nodeId]?.pendingQuestion) {
              updated[nodeId] = {
                ...updated[nodeId],
                pendingQuestion: undefined,
                status: 'thinking'
              };
            }
          }
          return updated;
        });
      } else {
        console.error('❌ HITL answer submission failed:', response.statusText);
      }
    } catch (err) {
      console.error('❌ HITL answer submission error:', err);
    }
  }, [config]);

  // Get current pending HITL question (first one found)
  const pendingHITLQuestion = useMemo(() => {
    for (const [nodeId, data] of Object.entries(agentProgressData)) {
      if (data?.pendingQuestion) {
        return {
          nodeId,
          questionId: data.pendingQuestion.executionId || `hitl-${nodeId}`,
          prompt: data.pendingQuestion.prompt || data.pendingQuestion.questions?.[0]?.question || '',
          choices: data.pendingQuestion.choices,
          inputType: data.pendingQuestion.inputType,
          timeout: data.pendingQuestion.timeout,
        };
      }
    }
    return null;
  }, [agentProgressData]);

  // The human-facing response of the last run: the terminal node's output
  // text extracted from the per-node result envelope. THIS (not `result`) is
  // what end users should see — render it as markdown (e.g. <MarkdownText>),
  // never JSON.stringify the raw result.
  const responseText = useMemo(() => extractWorkflowResponse(result), [result]);

  return {
    isConnected,
    isExecuting,
    nodeStates,
    agentProgress,
    agentProgressData,  // NEW: Per-node agent progress with message accumulation
    result,
    responseText,       // final output text (markdown) — the thing to display
    error,
    executeWorkflow,
    reconnect: connect,
    // Auto-open agent drawer support
    autoOpenAgentNodeId,
    resetAutoOpen,
    // Clear persisted state
    clearExecutionState,
    // Chat support for workflows with chat_trigger
    chatMessages,
    isChatLoading,
    sendChatMessage,
    clearChatMessages,
    // Terminate/stop workflow
    terminateWorkflow,
    // HITL support
    pendingHITLQuestion,
    submitHITLAnswer,
  };
}

export default useWorkflowProgress;
