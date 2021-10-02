import "@testing-library/jest-dom";

// jsdom has no ResizeObserver, and the map hook observes its container on mount.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub;
