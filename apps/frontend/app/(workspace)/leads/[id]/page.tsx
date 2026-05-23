import { LeadDetailPage } from "@/components/leads/lead-editor";

export const dynamic = "force-dynamic";

export default function LeadDetailRoutePage({ params }: { params: { id: string } }) {
  return <LeadDetailPage leadId={params.id} />;
}
