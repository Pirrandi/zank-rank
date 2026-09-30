import { Placeholder } from "../placeholder";
import { getRankingAdminContext } from "@/lib/ranking-access";

export default async function AdminRoastsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getRankingAdminContext(slug);
  return (
    <Placeholder
      title="Roasts IA"
      subtitle="Cuánto duele cada mensaje. Con responsabilidad."
      items={["Prompt del roast", "Palabras baneadas", "Intensidad"]}
    />
  );
}