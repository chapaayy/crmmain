import { EmployeeTaskDetailPage } from "@/components/employee-work/employee-tasks-page";

export default function Page({ params }: { params: { id: string } }) {
  return <EmployeeTaskDetailPage taskId={params.id} />;
}
