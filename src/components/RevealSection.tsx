import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";
import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";

type RevealSectionProps = {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  staggerStepMs?: number;
  sectionIndex?: number;
};

const RevealSection = ({
  children,
  className,
  stagger = false,
  staggerStepMs = dashboardMotionDelays.itemStepMs,
  sectionIndex = 0,
}: RevealSectionProps) => {
  const sectionDelay = sectionIndex * dashboardMotionDelays.sectionStepMs;

  return (
    <section
      className={cn("reveal", className)}
      data-reveal-section="true"
      style={{
        transitionDelay: `${sectionDelay}ms`,
      } as CSSProperties}
    >
      {stagger
        ? (
          <StaggerContainer stepMs={staggerStepMs}>
            {children}
          </StaggerContainer>
        )
        : children}
    </section>
  );
};

const StaggerContainer = ({
  children,
  stepMs,
}: {
  children: ReactNode;
  stepMs: number;
}) => {
  return (
    <>
      {Array.isArray(children)
        ? children.map((child, i) => {
          const delay = Math.min(i * stepMs, 300);
          return (
            <div
              key={i}
              data-reveal-child="true"
              data-reveal-delay={`${delay}`}
              style={{ transitionDelay: `${delay}ms` } as CSSProperties}
            >
              {child}
            </div>
          );
        })
        : children}
    </>
  );
};

export default RevealSection;
