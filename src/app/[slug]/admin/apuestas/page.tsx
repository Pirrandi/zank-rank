import { Placeholder } from "../placeholder";
import { getRankingAdminContext } from "@/lib/ranking-access";

export default async function AdminApuestasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getRankingAdminContext(slug);
  return (
    <Placeholder
      title="Apuestas"
      subtitle="Las ZankCoins: saldo inicial, ventana y cuánto paga acertar."
      items={["Saldo inicial", "Ventana de apuestas", "Multiplicadores"]}
    />
  );
}