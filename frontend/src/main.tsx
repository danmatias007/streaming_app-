import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./AuthContext";
import { I18nProvider } from "./I18nContext";
import "./styles.css";
import "./product.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider><AuthProvider><App /></AuthProvider></I18nProvider>
  </StrictMode>
);
