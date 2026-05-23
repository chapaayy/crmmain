import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/components/admin/admin-types";

export function PaginationControls({
  meta,
  onPageChange
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (!meta) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <div className="text-muted-foreground">
        Page {meta.page} of {Math.max(meta.totalPages, 1)} - {meta.total} records
      </div>
      <div className="flex gap-2">
        <Button
          disabled={meta.page <= 1}
          type="button"
          variant="outline"
          onClick={() => onPageChange(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          disabled={meta.page >= meta.totalPages}
          type="button"
          variant="outline"
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
