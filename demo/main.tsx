/** @fileoverview Mounts the public demo and its application-only styles. */
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../src/styles.css";
import "./styles.css";
import "./comparison/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The Digitloom demo requires a root element.");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
