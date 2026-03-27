import DashboardSeoRedirectsPanel from "@/components/dashboard/DashboardSeoRedirectsPanel";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useDashboardSettingsContext } from "./dashboard-settings-context";
import { dashboardSettingsCardClassName, seoLogoEditorFields } from "./shared";

export const DashboardSettingsSeoTab = () => {
  const { renderLogoEditorCards } = useDashboardSettingsContext();

  return (
    <TabsContent value="seo" className="mt-6 space-y-6">
      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold">Metadados visuais</h2>
            <p className="text-xs text-foreground/70">
              Ativos usados na aba do navegador e nas prévias de compartilhamento.
            </p>
          </div>

          {renderLogoEditorCards(seoLogoEditorFields)}
        </CardContent>
      </Card>

      <DashboardSeoRedirectsPanel />
    </TabsContent>
  );
};

export default DashboardSettingsSeoTab;
