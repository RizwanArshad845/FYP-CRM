import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Set a global flag during page teardown to suppress false-positive network errors
window.addEventListener('beforeunload', () => {
  (window as any).isUnloading = true;
});

createRoot(document.getElementById('root')!).render(<App />);