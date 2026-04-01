import { ArrowLeft, PencilLine } from "lucide-react";
import { Link } from "react-router-dom";

import UploadPicture from "@/components/UploadPicture";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

type LightNovelReadingHeaderChapterLink = {
  href: string;
  label: string;
};

type LightNovelReadingHeaderProps = {
  projectTitle: string;
  projectType: string;
  chapterTitle: string;
  chapterLabel: string;
  synopsis?: string;
  volume?: number;
  heroImage: string;
  heroImageAlt: string;
  mediaVariants?: UploadMediaVariantsMap;
  backHref: string;
  editHref?: string;
  editActionLabel?: string;
};

const LightNovelReadingHeader = ({
  projectTitle,
  projectType,
  chapterTitle,
  chapterLabel,
  synopsis = "",
  volume,
  heroImage,
  heroImageAlt,
  mediaVariants = {},
  backHref,
  editHref,
  editActionLabel = "Editar capitulo",
}: LightNovelReadingHeaderProps) => {
  const chapterTitleText = String(chapterTitle || "").trim() || projectTitle;
  const synopsisText = String(synopsis || "").trim();
  const projectTypeText = String(projectType || "").trim() || "Light Novel";
  const chapterBadgeText = String(chapterLabel || "").trim() || "Capitulo";

  return (
    <section data-testid="project-reading-hero" className="project-reading-masthead relative overflow-hidden">
      <UploadPicture
        src={heroImage}
        alt=""
        preset="hero"
        mediaVariants={mediaVariants}
        className="project-reading-masthead__media absolute inset-0 h-full w-full"
        imgClassName="h-full w-full object-cover object-top md:object-[center_18%]"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--veil absolute inset-0" />
      <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--horizontal absolute inset-0" />
      <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--bottom absolute inset-0" />

      <div
        className={`${publicPageLayoutTokens.sectionBase} project-reading-masthead__content relative max-w-6xl pb-10 pt-24 md:pb-16 md:pt-20 lg:pb-20 lg:pt-24`}
      >
        <div className="project-reading-masthead__layout grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_250px] md:gap-10 lg:grid-cols-[minmax(0,1fr)_270px]">
          <div className="project-reading-masthead__body order-2 mx-auto w-48 md:order-1 md:w-full">
            <div className="project-reading-masthead__meta flex w-full flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="project-reading-masthead__badge project-reading-masthead__badge--type text-xs uppercase tracking-wide"
              >
                {projectTypeText}
              </Badge>
              <Badge
                variant="outline"
                className="project-reading-masthead__badge project-reading-masthead__badge--chapter text-xs uppercase tracking-wide"
              >
                {chapterBadgeText}
                {Number.isFinite(volume) ? ` \u2022 Vol. ${volume}` : ""}
              </Badge>
            </div>

            <div className="project-reading-masthead__heading mt-4 space-y-2">
              <p className="project-reading-masthead__overline">{projectTitle}</p>
              <h1 className="project-reading-masthead__title">{chapterTitleText}</h1>
            </div>

            {synopsisText ? (
              <p className="project-reading-masthead__synopsis mt-4 max-w-3xl">{synopsisText}</p>
            ) : null}

            <div className="project-reading-masthead__actions mt-5 flex w-full flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="project-reading-action-btn project-reading-action-btn--secondary shrink-0"
              >
                <Link to={backHref}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Voltar ao projeto</span>
                </Link>
              </Button>

              {editHref ? (
                <Button
                  asChild
                  size="sm"
                  className="project-reading-action-btn project-reading-action-btn--primary"
                >
                  <Link to={editHref}>
                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                    <span>{editActionLabel}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="project-reading-masthead__cover order-1 mx-auto w-52 md:order-2 md:ml-auto md:w-[250px] lg:w-[270px]">
            <div
              className="project-reading-masthead__cover-frame overflow-hidden rounded-2xl border border-border/70 bg-secondary/90"
              style={{ aspectRatio: "9 / 14" }}
            >
              <UploadPicture
                src={heroImage}
                alt={heroImageAlt}
                preset="poster"
                mediaVariants={mediaVariants}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover object-center"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export type { LightNovelReadingHeaderChapterLink };

export default LightNovelReadingHeader;
