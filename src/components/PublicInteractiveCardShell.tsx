import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PublicInteractiveCardShadowPreset = "default" | "compact" | "none";

type PublicInteractiveCardShellProps = HTMLAttributes<HTMLDivElement> & {
  shadowPreset?: PublicInteractiveCardShadowPreset;
};

const PublicInteractiveCardShell = ({
  className,
  children,
  shadowPreset = "default",
  ...props
}: PublicInteractiveCardShellProps) => {
  const shouldRenderShadow = shadowPreset !== "none";

  return (
    <div
      className={cn(
        "public-interactive-card-shell",
        shadowPreset === "compact" && "public-interactive-card-shell--compact",
        shadowPreset === "none" && "public-interactive-card-shell--no-shadow",
        className,
      )}
      {...props}
    >
      {shouldRenderShadow ? (
        <>
          <div
            aria-hidden="true"
            className="public-interactive-card-shadow public-interactive-card-shadow--base rounded-[inherit]"
          />
          <div
            aria-hidden="true"
            className="public-interactive-card-shadow public-interactive-card-shadow--hover rounded-[inherit]"
          />
        </>
      ) : null}
      {children}
    </div>
  );
};

export default PublicInteractiveCardShell;
