import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";
import { TabsContent } from "@/components/ui/tabs";

import { useDashboardSettingsContext } from "./dashboard-settings-context";
import { dashboardSettingsCardClassName, readerProjectTypeMeta } from "./shared";

export const DashboardSettingsReaderTab = () => {
  const { readerPresets, updateReaderPreset } = useDashboardSettingsContext();

  return (
    <TabsContent forceMount value="leitor" className="mt-6 space-y-6 data-[state=inactive]:hidden">
      {readerProjectTypeMeta.map((presetMeta) => (
        <DashboardReaderPresetCard
          key={presetMeta.key}
          cardClassName={dashboardSettingsCardClassName}
          preset={readerPresets[presetMeta.key]}
          presetMeta={presetMeta}
          onUpdate={updateReaderPreset}
        />
      ))}
    </TabsContent>
  );
};

export default DashboardSettingsReaderTab;
