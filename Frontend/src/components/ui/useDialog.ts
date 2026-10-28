import { useLayoutEffect, useRef } from 'react';
const stack: HTMLElement[] = [];
const previousInert = new Map<HTMLElement, boolean>();
const focusable = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
function updateInert() {
  const top = stack[stack.length - 1];
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (!previousInert.has(child)) previousInert.set(child, child.inert);
    child.inert = top ? child !== top : previousInert.get(child) || false;
  }
  if (!top) previousInert.clear();
}
export function useDialog(onClose: () => void, initialFocus?: 'container' | 'first') {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(root); updateInert();
    const focusFirst = () => (initialFocus === 'container' ? root : root.querySelector<HTMLElement>('[data-autofocus]') || focusable(root)[0] || root).focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== root || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable(root);
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
      }
    };
    const focusin = (event: FocusEvent) => { if (stack[stack.length - 1] === root && !root.contains(event.target as Node)) focusFirst(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      stack.splice(stack.indexOf(root), 1); updateInert();
      document.removeEventListener('keydown', keydown); document.removeEventListener('focusin', focusin);
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();
      else if (!stack.length) document.querySelector<HTMLElement>('#main-content')?.focus();
    };
  }, [initialFocus]);
  return ref;
}
