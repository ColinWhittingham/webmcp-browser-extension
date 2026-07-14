import type { ActionResult } from './types';

export async function executeSelect(
  selector: string,
  paramName: string,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `select: element not found: ${selector}` };
  if (!(el instanceof HTMLSelectElement)) {
    return { ok: false, error: `select: element is not a <select>: ${selector}` };
  }
  el.value = String(params[paramName] ?? '');
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}
