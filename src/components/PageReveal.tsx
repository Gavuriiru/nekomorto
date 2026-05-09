import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageRevealProps = {
  children: ReactNode;
  className?: string;
};

const PageReveal = ({ children, className }: PageRevealProps) => {
  return (
    <div className={cn("page-reveal", className)}>
      {children}
    </div>
  );
};

export default PageReveal;
