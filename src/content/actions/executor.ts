import type { Action } from '../../shared/types';
import type { ActionResult } from './types';
import { executeCheck } from './check';
import { executeClick } from './click';
import { executeEnter } from './enter';
import { executeFill } from './fill';
import { executeSelect } from './select';
import { executeSubmit } from './submit';

export async function executeActionPlan(
  actions: Action[],
  params: Record<string, unknown>,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      let result: ActionResult;
      switch (action.type) {
        case 'fill':
          result = await executeFill(action.selector, action.paramName, params);
          break;
        case 'click':
          result = await executeClick(action.selector);
          break;
        case 'select':
          result = await executeSelect(action.selector, action.paramName, params);
          break;
        case 'check':
          result = await executeCheck(action.selector, action.paramName, params);
          break;
        case 'submit':
          result = await executeSubmit(action.selector);
          break;
        case 'enter':
          result = await executeEnter(action.selector);
          break;
      }
      results.push(result);
      if (!result.ok) break;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ ok: false, error: `executor: unexpected error: ${error}` });
      break;
    }
  }
  return results;
}
