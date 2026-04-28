
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import "./styles/globals.css";
  import { SocketProvider } from "./context/SocketContext";
  import { GlobalCallProvider } from "./context/GlobalCallContext";
  import { ThemeProvider } from "next-themes";
  import { LanguageProvider } from "./context/LanguageContext";
  import { AccessibilityProvider } from "./context/AccessibilityContext";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageProvider>
        <AccessibilityProvider>
          <SocketProvider>
            <GlobalCallProvider>
              <App />
            </GlobalCallProvider>
          </SocketProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
  