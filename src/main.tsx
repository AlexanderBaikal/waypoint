import { StrictMode } from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import "@fontsource/inter";
import "./index.css";
import { App } from "./App";
import { store } from "./app/store";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

ReactDOM.render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
  container,
);
