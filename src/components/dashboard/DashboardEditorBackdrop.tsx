import { DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DashboardEditorBackdropProps = {
  className?: string;
};

const DashboardEditorBackdrop = ({ className }: DashboardEditorBackdropProps) => (
  <DialogPortal>
    <div
      aria-hidden="true"
      data-testid="dashboard-editor-backdrop"
      className={cn(
        "pointer-events-auto fixed inset-0 z-45 bg-black/80 backdrop-blur-xs",
        className,
      )}
    />
  </DialogPortal>
);

export default DashboardEditorBackdrop;
