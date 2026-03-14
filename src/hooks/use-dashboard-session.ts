import { useContext } from "react";
import { DashboardSessionContext } from "@/hooks/dashboard-session-context";

export const useDashboardSession = () => useContext(DashboardSessionContext);
