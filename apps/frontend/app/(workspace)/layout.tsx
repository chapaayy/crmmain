import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/workspace/app-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
