import { Badge } from "@/components/ui/badge";

export function AdminPageHeader({
  title,
  description,
  permission
}: {
  title: string;
  description: string;
  permission: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="outline">{permission}</Badge>
    </div>
  );
}
