import { PayrollRunDetailPage } from "@/components/hr/payroll-pages";

export default function Page({ params }: { params: { id: string } }) {
  return <PayrollRunDetailPage runId={params.id} />;
}
