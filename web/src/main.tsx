
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento raíz de Lintea.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
