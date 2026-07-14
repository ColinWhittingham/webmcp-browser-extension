import type { ActionResult } from './types';

export async function executeSubmit(selector: string): Promise<ActionResult> {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `submit: element not found: ${selector}` };
  if (!(el instanceof HTMLFormElement)) {
    return { ok: false, error: `submit: element is not a <form>: ${selector}` };
  }
  if (typeof el.requestSubmit === 'function') {
    el.requestSubmit();
  } else {
    el.submit();
  }
  return { ok: true };
}
