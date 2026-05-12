import { type ReactNode, useEffect, useState } from "react";

type PublicPostLegacyContentProps = {
  content: string;
  format: "html" | "markdown";
  className?: string;
  ariaLabel?: string;
  fallback?: ReactNode;
};

const PublicPostLegacyContent = ({
  content,
  format,
  className,
  ariaLabel,
  fallback = null,
}: PublicPostLegacyContentProps) => {
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (format !== "html") {
      setSanitizedHtml(null);
      return;
    }

    let isActive = true;
    setSanitizedHtml(null);

    void import("dompurify")
      .then(({ default: DOMPurify }) => {
        if (!isActive) {
          return;
        }
        setSanitizedHtml(
          DOMPurify.sanitize(String(content || ""), {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ["script", "style"],
          }),
        );
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setSanitizedHtml("");
      });

    return () => {
      isActive = false;
    };
  }, [content, format]);

  if (format === "markdown") {
    return (
      <article aria-label={ariaLabel} className={className}>
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </article>
    );
  }

  if (sanitizedHtml === null) {
    return <>{fallback}</>;
  }

  return (
    <article
      aria-label={ariaLabel}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default PublicPostLegacyContent;
