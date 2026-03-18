import { type MouseEvent, useMemo } from "react";

import type { ButtonProps } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type CompactPaginationItem = number | "ellipsis";

export type CompactPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  linkSize?: ButtonProps["size"];
  linkClassName?: string;
  previousClassName?: string;
  nextClassName?: string;
  ellipsisClassName?: string;
};

const DISABLED_LINK_CLASS_NAME = "pointer-events-none opacity-50";

const buildCompactPaginationItems = (
  currentPage: number,
  totalPages: number,
): CompactPaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([1, totalPages]);

  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => visiblePages.add(page));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) =>
      visiblePages.add(page),
    );
  } else {
    [currentPage - 1, currentPage, currentPage + 1].forEach((page) => visiblePages.add(page));
  }

  const sortedPages = Array.from(visiblePages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  return sortedPages.reduce<CompactPaginationItem[]>((items, page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
    return items;
  }, []);
};

const CompactPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  contentClassName,
  linkSize = "default",
  linkClassName,
  previousClassName,
  nextClassName,
  ellipsisClassName,
}: CompactPaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginationItems = useMemo(
    () => buildCompactPaginationItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages],
  );

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, targetPage: number) => {
    event.preventDefault();
    if (disabled || targetPage === safeCurrentPage || targetPage < 1 || targetPage > totalPages) {
      return;
    }
    onPageChange(targetPage);
  };

  const previousDisabled = disabled || safeCurrentPage <= 1;
  const nextDisabled = disabled || safeCurrentPage >= totalPages;

  return (
    <Pagination className={className}>
      <PaginationContent className={contentClassName}>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={previousDisabled}
            tabIndex={previousDisabled ? -1 : undefined}
            className={cn(previousDisabled && DISABLED_LINK_CLASS_NAME, previousClassName)}
            onClick={(event) => handleNavigation(event, safeCurrentPage - 1)}
          />
        </PaginationItem>
        {paginationItems.map((item, index) => (
          <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
            {item === "ellipsis" ? (
              <PaginationEllipsis className={ellipsisClassName} />
            ) : (
              <PaginationLink
                href="#"
                size={linkSize}
                isActive={item === safeCurrentPage}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : undefined}
                className={cn(disabled && DISABLED_LINK_CLASS_NAME, linkClassName)}
                onClick={(event) => handleNavigation(event, item)}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={nextDisabled}
            tabIndex={nextDisabled ? -1 : undefined}
            className={cn(nextDisabled && DISABLED_LINK_CLASS_NAME, nextClassName)}
            onClick={(event) => handleNavigation(event, safeCurrentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export default CompactPagination;
