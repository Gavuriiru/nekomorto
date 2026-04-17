import { DashboardSessionContext } from "@/hooks/dashboard-session-context";
import { useContext } from "react";

export const useDashboardSession = () => useContext(DashboardSessionContext);
