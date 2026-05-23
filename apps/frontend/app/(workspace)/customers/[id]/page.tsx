import { CustomerDetailPage } from "@/components/customers/customer-editor";

export const dynamic = "force-dynamic";

export default function CustomerDetailRoutePage({ params }: { params: { id: string } }) {
  return <CustomerDetailPage customerId={params.id} />;
}
