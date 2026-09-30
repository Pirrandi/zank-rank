import { Placeholder } from "../placeholder";
import { getRankingAdminContext } from "@/lib/ranking-access";

export default async function AdminSyncPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getRankingAdminContext(slug);
  return (
    <Placeholder
      title="Sync y datos"
      subtitle="Cada cuánto se consulta la API de Riot y qué se guarda."
      items={["Intervalo de sync", "Qué datos se guardan"]}
    />
  );
}