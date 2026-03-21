import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Ledger — Personal Finance Visualizer",
  description: "Track expenses, manage budgets, and visualize your finances",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#1e1e35",
                  color: "#fff",
                  border: "1px solid #28284a",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                },
                success: { iconTheme: { primary: "#c8ff00", secondary: "#0a0a0f" } },
                error: { iconTheme: { primary: "#ff6b6b", secondary: "#0a0a0f" } },
              }}
            />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
