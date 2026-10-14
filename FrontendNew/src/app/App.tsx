import { Component, type ErrorInfo, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected application error",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Unhandled render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F3F7FF",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#ffffff",
              border: "1px solid #D6E4FF",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "#0A0A0A" }}>Something went wrong</h2>
            <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14 }}>
              The app hit an unexpected issue. Please reload once.
            </p>
            <p style={{ margin: "0 0 16px", color: "#6B7280", fontSize: 13 }}>
              Details: {this.state.message || "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "linear-gradient(135deg, #0B3D91, #1D4ED8)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
