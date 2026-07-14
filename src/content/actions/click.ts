import type { ActionResult } from './types';

export async function executeClick(selector: string): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `click: element not found: ${selector}` };
  if (!(el instanceof HTMLElement)) {
    return { ok: false, error: `click: element is not an HTMLElement: ${selector}` };
  }
  el.focus();
  el.click();
  return { ok: true };
}
