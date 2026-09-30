import { Placeholder } from "../placeholder";
import { getRankingAdminContext } from "@/lib/ranking-access";

export default async function AdminMurosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getRankingAdminContext(slug);
  return (
    <Placeholder
      title="Muros"
      subtitle="Qué entra a la fama y a la vergüenza, y entradas a mano para los memes."
      items={["Entradas manuales", "Vaciar muros"]}
    />
  );
}