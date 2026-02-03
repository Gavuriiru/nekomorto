import { useContext } from "react";
import { SiteSettingsContext } from "@/hooks/site-settings-context";

export const useSiteSettings = () => useContext(SiteSettingsContext);
