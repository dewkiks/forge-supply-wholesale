export interface ActionVariable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  source: 'user' | 'context' | 'constant';
  required: boolean;
  default?: string | number | boolean | null;
  description?: string;
}
export interface WorkflowAction {
  id: string;
  label: string;
  workflowId: string;
  promptTemplate: string;
  promptTarget: string;
  variables: ActionVariable[];
  inputBindings: Record<string, string>;
  expectedResult: string;
  uiLocations: string[];
  status: 'ready' | 'requires_workflow_changes';
}

/** Pure template substitution. Used for previews as well as execution. */
export function resolveAction(action: WorkflowAction, values: Record<string, unknown>) {
  if (action.status !== 'ready') throw new Error('This action requires workflow changes');
  const names = new Set(action.variables.map(v => v.name));
  if (names.size !== action.variables.length) throw new Error('Duplicate action variables');
  for (const name of Object.keys(values)) {
    if (!names.has(name)) throw new Error(`Unknown variable: ${name}`);
  }
  const resolved: Record<string, unknown> = Object.create(null);
  for (const variable of action.variables) {
    let value = Object.hasOwn(values, variable.name) ? values[variable.name] : variable.default;
    if (value == null) {
      if (variable.required) throw new Error(`Missing variable: ${variable.name}`);
      value = { string: '', number: 0, boolean: false }[variable.type];
    }
    if (typeof value !== variable.type || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error(`Variable ${variable.name} must be ${variable.type}`);
    }
    resolved[variable.name] = value;
  }
  const token = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
  if (/\{\{|\}\}/.test(action.promptTemplate.replace(token, ''))) {
    throw new Error('Only {{variable}} template expressions are supported');
  }
  const prompt = action.promptTemplate.replace(token, (_match, name: string) => {
    if (!names.has(name)) throw new Error(`Undeclared variable: ${name}`);
    return String(resolved[name]);
  });
  const inputs: Record<string, unknown> = Object.create(null);
  inputs[action.promptTarget] = prompt;
  for (const [target, name] of Object.entries(action.inputBindings)) {
    if (!names.has(name)) throw new Error(`Undeclared variable: ${name}`);
    if (target === action.promptTarget) throw new Error('Duplicate prompt target');
    inputs[target] = resolved[name];
  }
  return { prompt, inputs, workflowId: action.workflowId };
}
