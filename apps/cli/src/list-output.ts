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
  const { label, pageCount, totalCount, hasMore, nextCursor, query, nextPageHint } = meta;
  const titleParts: string[] = [label];

  if (query) {
    titleParts.push(`搜索「${query}」`);
  }

  if (!hasMore && pageCount === totalCount) {
    titleParts.push(`共 ${totalCount} 条`);
  } else {
    titleParts.push(`本页 ${pageCount} 条 / 共 ${totalCount} 条`);
  }

  console.log(titleParts.join(" · "));

  if (hasMore && nextCursor && nextPageHint) {
    console.log(`下一页：${nextPageHint} --cursor ${nextCursor}`);
  }

  if (pageCount > 0) {
    console.log("─".repeat(32));
  }
}

export function printEmptyList(message: string): void {
  console.log(message);
}
