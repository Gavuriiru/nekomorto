import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16);
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const reactRouterFutureWarnings = [
  "React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7.",
  "React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7.",
];

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === "string" &&
    reactRouterFutureWarnings.some((warning) => firstArg.includes(warning))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};
