import { SectionScreen } from "@/components/workspace/section-screen";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <SectionScreen title="Admin Dashboard" permission="users.read" />;
}
