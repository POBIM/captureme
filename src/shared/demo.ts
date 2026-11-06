/// <reference types="vite/client" />
// Marketing-capture hook (see marketing/README.md): a page may be shown in a prepared state when an init script
// sets `window.__DEMO = { <command>: <value> }`. Only `vite dev` (import.meta.env.DEV) honours it – in a production
// build this function is replaced by `undefined` and the calls below are dead code.
export function demoOverride<T>(command: string): T | undefined {
  return import.meta.env.DEV ? (window as unknown as { __DEMO?: Record<string, T> }).__DEMO?.[command] : undefined;
}
