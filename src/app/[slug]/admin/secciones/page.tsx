import { Placeholder } from "../placeholder";
import { getRankingAdminContext } from "@/lib/ranking-access";

export default async function AdminSeccionesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getRankingAdminContext(slug);
  return (
    <Placeholder
      title="Secciones y fondos"
      subtitle="Prendé, apagá, renombrá y reordená cada sección. Subí un meme de fondo para cada una."
      items={["Secciones on/off", "Renombrar y reordenar", "Fondos por sección"]}
    />
  );
}