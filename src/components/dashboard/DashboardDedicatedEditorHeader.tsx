import type { ReactNode } from "react";

type DashboardDedicatedEditorHeaderProps = {
  shellTestId?: string;
  mastheadTestId?: string;
  commandBarTestId?: string;
  primaryRowTestId?: string;
  primaryStatusTestId?: string;
  primaryActionsTestId?: string;
  secondaryMetaTestId?: string;
  secondaryActionsTestId?: string;
  badges?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  summaryCard?: ReactNode;
  primaryStatus?: ReactNode;
  primaryActions?: ReactNode;
  secondaryMeta?: ReactNode;
  secondaryActions?: ReactNode;
};

const mastheadClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.7)]";
const commandBarClassName =
  "sticky top-3 z-20 overflow-hidden rounded-2xl border border-border/60 bg-background/92 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.72)] backdrop-blur supports-backdrop-filter:bg-background/78";

const DashboardDedicatedEditorHeader = ({
  shellTestId,
  mastheadTestId,
  commandBarTestId,
  primaryRowTestId,
  primaryStatusTestId,
  primaryActionsTestId,
  secondaryMetaTestId,
  secondaryActionsTestId,
  badges,
  title,
  description,
  summaryCard,
  primaryStatus,
  primaryActions,
  secondaryMeta,
  secondaryActions,
}: DashboardDedicatedEditorHeaderProps) => (
  <div className="space-y-3" data-testid={shellTestId}>
    <section className={mastheadClassName} data-testid={mastheadTestId}>
      <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-8">
        <div className="space-y-3">
          {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{title}</h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {summaryCard ? (
          <div className="rounded-[22px] border border-border/50 bg-background/45 p-4 text-left shadow-[0_16px_50px_-40px_rgba(0,0,0,0.8)] lg:text-right">
            {summaryCard}
          </div>
        ) : null}
      </div>
    </section>

    <div className={commandBarClassName} data-testid={commandBarTestId}>
      <div className="space-y-3 px-4 py-3 md:px-6 lg:px-8">
        <div
          className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          data-testid={primaryRowTestId}
        >
          <div className="flex flex-wrap items-center gap-2" data-testid={primaryStatusTestId}>
            {primaryStatus}
          </div>
          <div
            className="flex flex-wrap items-center gap-2 lg:justify-end"
            data-testid={primaryActionsTestId}
          >
            {primaryActions}
          </div>
        </div>

        {secondaryMeta || secondaryActions ? (
          <div className="flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2" data-testid={secondaryMetaTestId}>
              {secondaryMeta}
            </div>
            <div
              className="flex flex-wrap items-center gap-2 lg:justify-end"
              data-testid={secondaryActionsTestId}
            >
              {secondaryActions}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

export default DashboardDedicatedEditorHeader;
