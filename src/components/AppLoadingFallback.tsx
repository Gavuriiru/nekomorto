import { Loader2 } from "lucide-react";

type AppLoadingFallbackProps = {
  label?: string;
  className?: string;
  fullScreen?: boolean;
};

const AppLoadingFallback = ({
  label = "Carregando...",
  className,
  fullScreen = false,
}: AppLoadingFallbackProps) => (
  <div
    aria-busy="true"
    aria-live="polite"
    role="status"
    className={className}
    style={{
      display: "flex",
      width: "100%",
      minHeight: fullScreen ? "100vh" : "55vh",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
    }}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          height: "3rem",
          width: "3rem",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          border: "1px solid var(--app-loader-accent-soft)",
          color: "var(--app-loader-accent)",
        }}
      >
        <Loader2 className="animate-spin" size={24} />
      </span>
      <span
        style={{
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
          lineHeight: 1.25,
        }}
      >
        {label}
      </span>
    </div>
  </div>
);

export default AppLoadingFallback;
