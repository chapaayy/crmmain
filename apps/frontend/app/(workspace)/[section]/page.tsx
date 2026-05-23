import { notFound } from "next/navigation";
import { SectionScreen } from "@/components/workspace/section-screen";
import { sectionMeta } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default function SectionPage({ params }: { params: { section: string } }) {
  const meta = sectionMeta.get(params.section);

  if (!meta) {
    notFound();
  }

  return <SectionScreen title={meta.title} permission={meta.permission} />;
}
