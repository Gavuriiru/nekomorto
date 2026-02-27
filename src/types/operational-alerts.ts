export type OperationalAlertSeverity = "info" | "warning" | "critical";

export type OperationalAlert = {
  code: string;
  severity: OperationalAlertSeverity;
  title: string;
  description: string;
  since?: string | null;
  meta?: Record<string, unknown>;
};

export type OperationalAlertsResponse = {
  ok: boolean;
  status: "ok" | "degraded" | "fail";
  generatedAt: string;
  alerts: OperationalAlert[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
};

