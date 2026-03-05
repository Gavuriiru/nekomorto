import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { HeroSlide } from "@/components/HeroSection";

type HeroDesktopCarouselProps = {
  slides: HeroSlide[];
  heroViewportClass: string;
  renderSlide: (
    slide: HeroSlide,
    index: number,
    activeIndex: number,
    loadedSlideIds: Set<string>,
  ) => React.ReactNode;
};

const HERO_AUTOPLAY_INTERVAL_MS = 6000;
const HERO_AUTOPLAY_RESUME_DELAY_MS = 3000;
const HERO_AUTOPLAY_INITIAL_DELAY_MS = 20000;

const HeroDesktopCarousel = ({
  slides,
  heroViewportClass,
  renderSlide,
}: HeroDesktopCarouselProps) => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const resumeTimeoutRef = React.useRef<number | null>(null);
  const initialAutoplayTimeoutRef = React.useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [loadedSlideIds, setLoadedSlideIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    setActiveIndex(0);
    setLoadedSlideIds(new Set());
  }, [slides]);

  React.useEffect(() => {
    if (!api) {
      setActiveIndex(0);
      return;
    }
    const syncSelectedIndex = () => {
      setActiveIndex(api.selectedScrollSnap());
    };
    syncSelectedIndex();
    api.on("select", syncSelectedIndex);
    api.on("reInit", syncSelectedIndex);
    return () => {
      api.off("select", syncSelectedIndex);
      api.off("reInit", syncSelectedIndex);
    };
  }, [api]);

  React.useEffect(() => {
    if (!slides.length) {
      setLoadedSlideIds(new Set());
      return;
    }
    const activeSlide = slides[activeIndex] || slides[0];
    if (!activeSlide) {
      return;
    }
    setLoadedSlideIds((previous) => {
      if (previous.has(activeSlide.id)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(activeSlide.id);
      return next;
    });
  }, [activeIndex, slides]);

  const stopAutoplay = React.useCallback(() => {
    if (autoplayRef.current !== null) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const clearInitialAutoplayTimeout = React.useCallback(() => {
    if (initialAutoplayTimeoutRef.current !== null) {
      window.clearTimeout(initialAutoplayTimeoutRef.current);
      initialAutoplayTimeoutRef.current = null;
    }
  }, []);

  const startAutoplay = React.useCallback(() => {
    if (!api) {
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    stopAutoplay();
    autoplayRef.current = window.setInterval(() => {
      api.scrollNext();
    }, HERO_AUTOPLAY_INTERVAL_MS);
  }, [api, stopAutoplay]);

  const scheduleInitialAutoplay = React.useCallback(() => {
    clearInitialAutoplayTimeout();
    initialAutoplayTimeoutRef.current = window.setTimeout(() => {
      initialAutoplayTimeoutRef.current = null;
      startAutoplay();
    }, HERO_AUTOPLAY_INITIAL_DELAY_MS);
  }, [clearInitialAutoplayTimeout, startAutoplay]);

  const scheduleAutoplayResume = React.useCallback(() => {
    stopAutoplay();
    clearInitialAutoplayTimeout();
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      startAutoplay();
    }, HERO_AUTOPLAY_RESUME_DELAY_MS);
  }, [clearInitialAutoplayTimeout, startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    if (!api || slides.length <= 1) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoplay();
        clearInitialAutoplayTimeout();
        if (resumeTimeoutRef.current !== null) {
          window.clearTimeout(resumeTimeoutRef.current);
          resumeTimeoutRef.current = null;
        }
        return;
      }
      if (resumeTimeoutRef.current !== null || autoplayRef.current !== null) {
        return;
      }
      scheduleInitialAutoplay();
    };

    scheduleInitialAutoplay();
    api.on("pointerDown", scheduleAutoplayResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      api.off("pointerDown", scheduleAutoplayResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopAutoplay();
      clearInitialAutoplayTimeout();
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
  }, [
    api,
    slides.length,
    clearInitialAutoplayTimeout,
    scheduleInitialAutoplay,
    scheduleAutoplayResume,
    stopAutoplay,
  ]);

  const shouldRenderCarouselControls = slides.length > 1;

  return (
    <Carousel opts={{ loop: true }} setApi={setApi} className={heroViewportClass}>
      <CarouselContent className="ml-0">
        {slides.map((slide, index) => (
          <CarouselItem key={slide.id} className="pl-0">
            {renderSlide(slide, index, activeIndex, loadedSlideIds)}
          </CarouselItem>
        ))}
      </CarouselContent>
      {shouldRenderCarouselControls ? (
        <CarouselPrevious
          className="hidden md:flex left-auto right-20 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplayResume}
        />
      ) : null}
      {shouldRenderCarouselControls ? (
        <CarouselNext
          className="hidden md:flex right-8 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplayResume}
        />
      ) : null}
    </Carousel>
  );
};

export default HeroDesktopCarousel;
