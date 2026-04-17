import { SiteSettingsContext } from "@/hooks/site-settings-context";
import { useContext } from "react";

export const useSiteSettings = () => useContext(SiteSettingsContext);
