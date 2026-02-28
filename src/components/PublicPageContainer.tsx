import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";

const maxWidthClassMap = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

type PublicPageContainerProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  maxWidth?: keyof typeof maxWidthClassMap;
};

const PublicPageContainer = ({
  children,
  className,
  mainClassName,
  maxWidth = "6xl",
}: PublicPageContainerProps) => {
  return (
    <main className={cn(publicPageLayoutTokens.main, mainClassName)}>
      <section
        className={cn(
          publicPageLayoutTokens.sectionBase,
          publicPageLayoutTokens.sectionSpacing,
          maxWidthClassMap[maxWidth],
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
};

export default PublicPageContainer;
