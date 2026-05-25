import { EmployeeEditor } from "@/components/hr/employee-editor";

export default function Page({ params }: { params: { id: string } }) {
  return <EmployeeEditor employeeId={params.id} />;
}
