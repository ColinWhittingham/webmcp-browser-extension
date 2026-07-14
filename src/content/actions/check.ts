import type { ActionResult } from './types';

export async function executeCheck(
  selector: string,
  paramName: string,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `check: element not found: ${selector}` };
  if (!(el instanceof HTMLInputElement)) {
    return { ok: false, error: `check: element is not an input: ${selector}` };
  }
  el.checked = Boolean(params[paramName]);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}
