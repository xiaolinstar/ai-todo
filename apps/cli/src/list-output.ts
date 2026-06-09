export interface ListSummaryMeta {
  label: string;
  pageCount: number;
  totalCount: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  query?: string;
  nextPageHint?: string;
}

export function printListSummary(meta: ListSummaryMeta): void {
  const { label, pageCount, totalCount, query } = meta;
  const titleParts: string[] = [label];

  if (query) {
    titleParts.push(`search "${query}"`);
  }

  if (!meta.hasMore && pageCount === totalCount) {
    titleParts.push(`${totalCount} total`);
  } else {
    titleParts.push(`${pageCount} on this page / ${totalCount} total`);
  }

  console.log(titleParts.join(" · "));

  if (pageCount > 0) {
    console.log("─".repeat(32));
  }
}

export function printNextPageHint(meta: ListSummaryMeta): void {
  if (meta.hasMore && meta.nextCursor && meta.nextPageHint) {
    console.log("");
    console.log("More rows available. Use --json to copy nextCursor.");
  }
}

export function printEmptyList(message: string): void {
  console.log(message);
}
