import { installPwaCleanupReloadBridge, runPwaCleanup } from "@/lib/pwa-cleanup";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/fonts.css";

const bootstrap = async () => {
  installPwaCleanupReloadBridge();
  void runPwaCleanup().catch(() => undefined);

  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  createRoot(root).render(<App />);
};

bootstrap();
