import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
// Read campaign tags from the arrival URL before any navigation changes it.
import "./lib/utm";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
if (import.meta.env.DEV)
  void Promise.all([import("./state/designStore"), import("./state/editorStore")]).then(
    ([d, e]) => Object.assign(window, { __hbDesign: d.useDesignStore, __hbEditor: e.useEditorStore }),
  );
