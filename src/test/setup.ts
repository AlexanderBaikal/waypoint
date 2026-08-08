import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver, and the map hook observes its container on mount.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub;

// Nor scrollIntoView, which the type combobox uses to keep the highlighted
// suggestion in view as the arrow keys walk past the bottom of the list.
Element.prototype.scrollIntoView = function scrollIntoView() {
  // Layout is not something jsdom has; nothing to do but not throw.
};
