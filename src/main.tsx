import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/fonts.css";

const bootstrap = async () => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  createRoot(root).render(<App />);
};

bootstrap();
