import type { ActionResult } from './types';

export async function executeEnter(selector: string): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `enter: element not found: ${selector}` };
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true };
}
