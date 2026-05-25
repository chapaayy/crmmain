import { SecretDetailPage } from "@/components/employee-work/secrets-page";

export default function Page({ params }: { params: { id: string } }) {
  return <SecretDetailPage secretId={params.id} />;
}
