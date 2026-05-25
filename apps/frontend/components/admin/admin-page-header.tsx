import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/workspace/page-header";

export function AdminPageHeader({
  title,
  description,
  permission
}: {
  title: string;
  description: string;
  permission: string;
}) {
  return <PageHeader actions={<Badge variant="outline">{permission}</Badge>} className="mb-6" description={description} title={title} />;
}
