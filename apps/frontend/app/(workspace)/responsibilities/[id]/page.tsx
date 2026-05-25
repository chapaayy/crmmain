import { ResponsibilityDetailPage } from "@/components/employee-work/responsibilities-page";

export default function Page({ params }: { params: { id: string } }) {
  return <ResponsibilityDetailPage responsibilityId={params.id} />;
}
