import { Plus, Trash2 } from "lucide-react";

import DashboardLightSelect, {
  type DashboardLightSelectOption,
} from "@/components/dashboard/DashboardLightSelect";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

import { useDashboardSettingsContext } from "./dashboard-settings-context";
import {
  dashboardSettingsCardClassName,
  responsiveCompactRowDeleteButtonClass,
  responsiveSvgCardRowClass,
  roleIconMap,
  roleIconOptions,
} from "./shared";

const teamRoleSelectOptions: DashboardLightSelectOption[] = roleIconOptions.map(
  (option) => ({
    value: option.id,
    label: option.label,
    icon: roleIconMap[option.id] || null,
  }),
);

export const DashboardSettingsTeamTab = () => {
  const { setSettings, settings } = useDashboardSettingsContext();

  return (
    <TabsContent
      forceMount
      value="equipe"
      className="mt-6 space-y-6 data-[state=inactive]:hidden"
    >
      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Funções do time</h2>
              <p className="text-xs text-foreground/70">
                Ajuste os cargos disponíveis para membros.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  teamRoles: [
                    ...prev.teamRoles,
                    {
                      id: `role-${Date.now()}`,
                      label: "Nova função",
                      icon: "user",
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4">
            {settings.teamRoles.map((role, index) => (
              <div
                key={`${role.id}-${index}`}
                className={`${responsiveSvgCardRowClass} md:grid-cols-[1.4fr_1fr_auto]`}
              >
                <Input
                  value={role.label}
                  onChange={(event) =>
                    setSettings((prev) => {
                      const next = [...prev.teamRoles];
                      next[index] = {
                        ...next[index],
                        label: event.target.value,
                      };
                      return { ...prev, teamRoles: next };
                    })
                  }
                  placeholder="Nome"
                />
                <DashboardLightSelect
                  ariaLabel={`Ícone da função ${role.label || index + 1}`}
                  value={role.icon || "user"}
                  options={teamRoleSelectOptions}
                  onValueChange={(nextIcon) =>
                    setSettings((prev) => {
                      const next = [...prev.teamRoles];
                      next[index] = { ...next[index], icon: nextIcon };
                      return { ...prev, teamRoles: next };
                    })
                  }
                  className="min-w-0 w-full"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={responsiveCompactRowDeleteButtonClass}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      teamRoles: prev.teamRoles.filter(
                        (_, idx) => idx !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default DashboardSettingsTeamTab;
