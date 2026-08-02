import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

interface PaginationProps extends React.ComponentProps<"nav"> {
  current?: number
  total?: number
  onPageChange?: (page: number) => void
}

function Pagination({ className, current = 1, total = 1, onPageChange, ...props }: PaginationProps) {
  const renderPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5
    
    let startPage = Math.max(1, current - Math.floor(maxVisible / 2))
    let endPage = Math.min(total, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    // Перша сторінка
    if (startPage > 1) {
      pages.push(1)
    }

    // Многоточие
    if (startPage > 2) {
      pages.push('...')
    }

    // Сторінки в межах
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // Многоточие
    if (endPage < total - 1) {
      pages.push('...')
    }

    // Остання сторінка
    if (endPage < total) {
      pages.push(total)
    }

    return pages
  }

  const handlePrevious = () => {
    if (current > 1 && onPageChange) {
      onPageChange(current - 1)
    }
  }

  const handleNext = () => {
    if (current < total && onPageChange) {
      onPageChange(current + 1)
    }
  }

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number' && onPageChange) {
      onPageChange(page)
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    >
      <ul className="flex flex-row items-center gap-1 flex-wrap">
        <li>
          <button
            onClick={handlePrevious}
            disabled={current <= 1}
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "icon",
              }),
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            aria-label="Go to previous page"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        </li>
        
        {renderPageNumbers().map((page, idx) => (
          <li key={`${page}-${idx}`}>
            {page === '...' ? (
              <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">
                <MoreHorizontalIcon className="h-4 w-4" />
              </span>
            ) : (
              <button
                onClick={() => handlePageClick(page)}
                className={cn(
                  buttonVariants({
                    variant: current === page ? "outline" : "ghost",
                    size: "icon",
                  }),
                  "h-9 w-9"
                )}
                aria-current={current === page ? "page" : undefined}
              >
                {page}
              </button>
            )}
          </li>
        ))}
        
        <li>
          <button
            onClick={handleNext}
            disabled={current >= total}
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "icon",
              }),
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            aria-label="Go to next page"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  type PaginationProps,
}
