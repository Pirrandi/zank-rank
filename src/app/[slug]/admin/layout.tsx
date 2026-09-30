import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRankingAdminContext } from "@/lib/ranking-access";
import { logoutAction } from "./actions";
import { AdminNav } from "./admin-nav";
import "@/app/admin/admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  // Layout guard (design D2): every page and action below calls this guard itself too — a
  // layout guard alone does not stop parallel page rendering or server actions.
  const { slug } = await params;
  const { ranking } = await getRankingAdminContext(slug);
  const accountCount = await prisma.trackedAccount.count({ where: { rankingId: ranking.id } });
  let hosted = false;

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-logo">
            <Link href={`/${slug}/admin`} className="admin-logo-link">
              ZANK<span className="admin-logo-dot">.lol</span>
            </Link>
            <span className="admin-badge">ADMIN</span>
          </div>
          <div className="admin-header-actions">
            <Link href={`/${slug}`} className="admin-ver-sitio">
              Ver sitio ↗
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="admin-logout">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="admin-body">
        <AdminNav slug={slug} accountCount={accountCount} hosted={hosted} />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
