import { useCallback, useRef } from 'react';
import registry from '../flowbuilder/actions.json';
import workflows from '../flowbuilder/workflows.json';
import { resolveAction, type WorkflowAction } from '../flowbuilder/resolveAction';
import { getByteflowConfig, getInputSchemaFields, newExecutionId, registerWorkflowConfigs } from '../config/byteflow';
import { useWorkflowProgress } from './useWorkflowProgress';

registerWorkflowConfigs(workflows);

/** One hook instance owns one action's invocation stream and results. */
export function useWorkflowAction(actionId: string) {
  const boundAction = useRef(actionId);
  if (boundAction.current !== actionId) {
    throw new Error('Mount each workflow action in a component keyed by actionId to preserve isolated execution state');
  }
  const action = (registry.actions as WorkflowAction[]).find(item => item.id === actionId);
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  const config = getByteflowConfig(action.workflowId);
  const instance = useRef(newExecutionId());
  const progress = useWorkflowProgress({ ...config,
    channelId: `action_${config.projectId}_${action.workflowId}_${action.id}_${instance.current}`,
  });
  const preview = useCallback((values: Record<string, unknown>) => {
    const resolved = resolveAction(action, values);
    const fields = getInputSchemaFields(action.workflowId);
    for (const target of Object.keys(resolved.inputs)) {
      const field = fields.find(f => `${f.nodeId}.${f.field}` === target);
      if (!field) throw new Error(`Invalid override field: ${target}`);
      const type = ['select', 'multiline'].includes(field.type) ? 'string' : field.type;
      if (typeof resolved.inputs[target] !== type) throw new Error(`Invalid type for ${target}`);
    }
    return resolved;
  }, [action]);
  const execute = useCallback((values: Record<string, unknown>) => {
    const resolved = preview(values);
    return progress.executeWorkflow(resolved.inputs);
  }, [preview, progress.executeWorkflow]);
  return { ...progress, action, execute, preview };
}
