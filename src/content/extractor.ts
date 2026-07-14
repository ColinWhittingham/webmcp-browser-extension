import { MAX_ELEMENTS } from '../shared/constants';
import type { PageContext, PageElement } from '../shared/types';

function computeSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute('name');
  if (name) return `[name="${CSS.escape(name)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `[aria-label="${CSS.escape(aria)}"]`;
  // Fall back to nth-of-type path
  return buildNthPath(el);
}

function buildNthPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === current!.tagName,
    );
    const index = siblings.indexOf(current) + 1;
    parts.unshift(
      siblings.length > 1
        ? `${current.tagName.toLowerCase()}:nth-of-type(${index})`
        : current.tagName.toLowerCase(),
    );
    current = parent;
  }
  return parts.join(' > ');
}

function findLabelText(el: Element): string | undefined {
  // Check <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  // Check wrapping <label>
  const wrapping = el.closest('label');
  if (wrapping?.textContent) return wrapping.textContent.trim();
  return undefined;
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function getSelectOptions(el: Element): Array<{ value: string; label: string }> | undefined {
  if (!(el instanceof HTMLSelectElement)) return undefined;
  return Array.from(el.options)
    .filter((o) => o.value !== '')        // skip blank placeholder option
    .slice(0, 30)                          // cap to avoid token overflow
    .map((o) => ({ value: o.value, label: o.text.trim() }));
}

function getRole(el: Element): string | undefined {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  // Detect custom combobox / searchable dropdown patterns
  if (
    el.getAttribute('aria-haspopup') ||
    el.getAttribute('aria-autocomplete') ||
    el.getAttribute('aria-expanded') !== null
  ) {
    return 'combobox';
  }
  return undefined;
}

function extractElements(): PageElement[] {
  const seen = new Set<Element>();
  const elements: Array<{ el: Element; priority: number }> = [];

  const selectors = [
    'form',
    'input:not([type="hidden"]):not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'button:not([disabled])',
    'input[type="submit"]:not([disabled])',
    // Custom combobox / searchable dropdown patterns
    '[role="combobox"]:not([disabled])',
    '[aria-haspopup="listbox"]:not([disabled])',
    '[aria-haspopup="true"]:not([disabled])',
  ];

  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      if (!isVisible(el)) continue;
      seen.add(el);
      const priority = isInViewport(el) ? 0 : 1;
      elements.push({ el, priority });
    }
  }

  elements.sort((a, b) => a.priority - b.priority);
  const capped = elements.slice(0, MAX_ELEMENTS);

  return capped.map(({ el }): PageElement => {
    const tag = el.tagName.toLowerCase();
    const input = el instanceof HTMLInputElement ? el : null;
    const form = el.closest('form');

    return {
      tag,
      type: input?.type,
      id: el.id || undefined,
      name: el.getAttribute('name') ?? undefined,
      placeholder: (el as HTMLInputElement).placeholder || undefined,
      ariaLabel: el.getAttribute('aria-label') ?? undefined,
      labelText: findLabelText(el),
      selector: computeSelector(el),
      inViewport: isInViewport(el),
      formSelector: form ? computeSelector(form) : undefined,
      role: getRole(el),
      options: getSelectOptions(el),
    };
  });
}

export function extractPageContext(): PageContext {
  const allElements = extractElements();
  return {
    url: `${location.origin}${location.pathname}${location.search}`,
    title: document.title,
    elements: allElements,
    elementCount: allElements.length,
  };
}
