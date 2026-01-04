import { Revenue } from './definitions';


export const formatCurrency = (amount: number) => {
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

export const formatDateToLocal = (
  dateStr: string,
  locale: string = 'en-US',
) => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(date);
};


export const generatePagination = (currentPage: number, totalPages: number) => {
  // If the total number of pages is 7 or less,
  // display all pages without any ellipsis.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If the current page is among the first 3 pages,
  // show the first 3, an ellipsis, and the last 2 pages.
  if (currentPage <= 3) {
    return [1, 2, 3, '...', totalPages - 1, totalPages];
  }

  // If the current page is among the last 3 pages,
  // show the first 2, an ellipsis, and the last 3 pages.
  if (currentPage >= totalPages - 2) {
    return [1, 2, '...', totalPages - 2, totalPages - 1, totalPages];
  }

  // If the current page is somewhere in the middle,
  // show the first page, an ellipsis, the current page and its neighbors,
  // another ellipsis, and the last page.
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages,
  ];
};

export function generateYAxis(revenue: { revenue: number }[]) {
  const max = Math.max(0, ...revenue.map((r) => Number(r.revenue) || 0));

  // Safety: kui pole andmeid
  if (max <= 0) {
    return { yAxisLabels: ['$0'], topLabel: 1 };
  }

  // Dünaamiline "nice" samm (1 / 2 / 5 * 10^n)
  const targetTicks = 5;
  const rough = max / targetTicks;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const scaled = rough / pow10;

  const niceScaled =
    scaled <= 1 ? 1 :
    scaled <= 2 ? 2 :
    scaled <= 5 ? 5 : 10;

  const step = niceScaled * pow10;
  const topLabel = Math.ceil(max / step) * step;

  const yAxisLabels: string[] = [];
  for (let v = topLabel; v >= 0; v -= step) {
    yAxisLabels.push(`$${v.toLocaleString()}`);
  }

  return { yAxisLabels, topLabel };
}