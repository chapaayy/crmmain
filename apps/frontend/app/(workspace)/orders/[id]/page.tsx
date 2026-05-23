import { OrderDetailPage } from "@/components/orders/order-editor";

export const dynamic = "force-dynamic";

export default function OrderDetailRoutePage({ params }: { params: { id: string } }) {
  return <OrderDetailPage orderId={params.id} />;
}
