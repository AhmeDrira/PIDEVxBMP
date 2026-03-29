
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import { SocketProvider } from "./context/SocketContext";
  import { GlobalCallProvider } from "./context/GlobalCallContext";

  createRoot(document.getElementById("root")!).render(
    <SocketProvider>
      <GlobalCallProvider>
        <App />
      </GlobalCallProvider>
    </SocketProvider>
  );
  