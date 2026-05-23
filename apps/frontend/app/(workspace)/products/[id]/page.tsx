import { ProductDetailPage } from "@/components/products/product-editor";

export const dynamic = "force-dynamic";

export default function ProductDetailRoutePage({ params }: { params: { id: string } }) {
  return <ProductDetailPage productId={params.id} />;
}
