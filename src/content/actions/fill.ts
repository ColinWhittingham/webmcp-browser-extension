import type { ActionResult } from './types';

export async function executeFill(
  selector: string,
  paramName: string,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `fill: element not found: ${selector}` };
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return { ok: false, error: `fill: element is not an input or textarea: ${selector}` };
  }
  const value = String(params[paramName] ?? '');
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}
