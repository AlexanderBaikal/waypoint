import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "../app/store";

/**
 * Renders inside a store created for this test only, and hands the store back
 * so a test can assert on state as well as on the DOM.
 */
export function renderWithStore(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { store?: AppStore },
) {
  const store = options?.store ?? makeStore();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
