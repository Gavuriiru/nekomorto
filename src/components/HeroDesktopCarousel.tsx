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
    activeAnimationCycle: number | null,
  ) => React.ReactNode;
};

const HERO_AUTOPLAY_INTERVAL_MS = 5000;

const HeroDesktopCarousel = ({
  slides,
  heroViewportClass,
  renderSlide,
}: HeroDesktopCarouselProps) => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayTimeoutRef = React.useRef<number | null>(null);
  const previousSelectedIndexRef = React.useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [activeAnimationCycle, setActiveAnimationCycle] = React.useState<number | null>(null);
  const [loadedSlideIds, setLoadedSlideIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    previousSelectedIndexRef.current = null;
    setActiveIndex(0);
    setActiveAnimationCycle(null);
    setLoadedSlideIds(new Set());
  }, [slides]);

  React.useLayoutEffect(() => {
    if (!api) {
      previousSelectedIndexRef.current = null;
      setActiveIndex(0);
      setActiveAnimationCycle(null);
      return;
    }
    const syncSelectedIndex = () => {
      const nextIndex = api.selectedScrollSnap();
      setActiveIndex(nextIndex);

      if (previousSelectedIndexRef.current === null) {
        previousSelectedIndexRef.current = nextIndex;
        setActiveAnimationCycle(0);
        return;
      }

      if (previousSelectedIndexRef.current === nextIndex) {
        return;
      }

      previousSelectedIndexRef.current = nextIndex;
      setActiveAnimationCycle((previousCycle) => (previousCycle ?? 0) + 1);
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

  const clearAutoplayTimeout = React.useCallback(() => {
    if (autoplayTimeoutRef.current !== null) {
      window.clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoplay = React.useCallback(() => {
    if (!api) {
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    clearAutoplayTimeout();
    autoplayTimeoutRef.current = window.setTimeout(() => {
      autoplayTimeoutRef.current = null;
      api.scrollNext();
    }, HERO_AUTOPLAY_INTERVAL_MS);
  }, [api, clearAutoplayTimeout]);

  React.useEffect(() => {
    if (!api || slides.length <= 1) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAutoplayTimeout();
        return;
      }
      scheduleAutoplay();
    };

    scheduleAutoplay();
    api.on("pointerDown", scheduleAutoplay);
    api.on("select", scheduleAutoplay);
    api.on("reInit", scheduleAutoplay);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      api.off("pointerDown", scheduleAutoplay);
      api.off("select", scheduleAutoplay);
      api.off("reInit", scheduleAutoplay);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearAutoplayTimeout();
    };
  }, [api, slides.length, clearAutoplayTimeout, scheduleAutoplay]);

  const shouldRenderCarouselControls = slides.length > 1;

  return (
    <Carousel opts={{ loop: true }} setApi={setApi} className={heroViewportClass}>
      <CarouselContent className="ml-0">
        {slides.map((slide, index) => (
          <CarouselItem key={slide.id} className="pl-0">
            {renderSlide(slide, index, activeIndex, loadedSlideIds, activeAnimationCycle)}
          </CarouselItem>
        ))}
      </CarouselContent>
      {shouldRenderCarouselControls ? (
        <CarouselPrevious
          className="hidden md:flex left-auto right-20 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplay}
        />
      ) : null}
      {shouldRenderCarouselControls ? (
        <CarouselNext
          className="hidden md:flex right-8 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplay}
        />
      ) : null}
    </Carousel>
  );
};

export default HeroDesktopCarousel;
