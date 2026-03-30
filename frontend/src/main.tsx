
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import { SocketProvider } from "./context/SocketContext";
  import { GlobalCallProvider } from "./context/GlobalCallContext";
  import { ThemeProvider } from "next-themes";
  import { LanguageProvider } from "./context/LanguageContext";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageProvider>
        <SocketProvider>
          <GlobalCallProvider>
            <App />
          </GlobalCallProvider>
        </SocketProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
  