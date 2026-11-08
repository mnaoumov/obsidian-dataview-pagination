/**
 * How many page numbers are shown on each side of the current page.
 */
const PAGE_NUMBER_RADIUS = 2;

/**
 * Moves a page number into the valid range, for example after a refresh removed rows.
 *
 * @param page - The requested 1-based page number.
 * @param pageCount - The number of pages.
 * @returns The nearest valid page number.
 */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), pageCount);
}

/**
 * Gets the number of pages needed to show the items. An empty list still has one page.
 *
 * @param itemCount - The total number of items.
 * @param pageSize - The number of items per page.
 * @returns The number of pages, at least 1.
 */
export function getPageCount(itemCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

/**
 * Gets the items of one page.
 *
 * @param items - All items.
 * @param page - The 1-based page number.
 * @param pageSize - The number of items per page.
 * @returns The items of that page.
 */
export function getPageItems<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Gets the page numbers to show around the current page.
 *
 * @param page - The current 1-based page number.
 * @param pageCount - The number of pages.
 * @returns The page numbers, ascending.
 */
export function getVisiblePageNumbers(page: number, pageCount: number): number[] {
  const first = Math.max(1, page - PAGE_NUMBER_RADIUS);
  const last = Math.min(pageCount, page + PAGE_NUMBER_RADIUS);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/**
 * Parses the comma-separated page sizes of the settings. Entries that are not positive whole numbers are dropped.
 *
 * @param text - The settings text, for example `25, 50, 100`.
 * @returns The page sizes in the order written, with repeats removed.
 */
export function parsePageSizes(text: string): number[] {
  const sizes = text.split(',').map((part) => Number(part.trim())).filter((size) => Number.isSafeInteger(size) && size > 0);
  return [...new Set(sizes)];
}
