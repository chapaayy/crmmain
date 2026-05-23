import { UserDetailAdmin } from "@/components/admin/user-detail-admin";

export const dynamic = "force-dynamic";

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetailAdmin userId={params.id} />;
}
