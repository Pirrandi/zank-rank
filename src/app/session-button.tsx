import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-guards";
import { ROOT_SLUG } from "@/lib/ranking";
import { publicLogoutAction } from "./logout/actions";

// Control de sesión para la esquina superior de las páginas públicas (nav y landing).
// Server component, sin estado de cliente: con sesión activa muestra "Mi panel" (task 5.4,
// hosted → /dashboard, self-hosted → la admin de la ranking raíz) y "Cerrar sesión" (server
// action que borra la cookie); sin sesión muestra "Entrar" (inicio del OAuth de Discord),
// env-gated igual que el login de admin y de la landing (design D6).
// `next` es la página actual: se pasa al flujo OAuth como ?next= para que el callback
// devuelva al usuario al lugar donde inició el login.
export async function SessionButton({ next = "/" }: { next?: string }) {
  const current = await getCurrentUser();
  const discordEnabled = Boolean(process.env.DISCORD_CLIENT_ID);

  if (current) {
    let panelHref = `/${ROOT_SLUG}/admin`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={panelHref} className="session-btn">
          Mi panel
        </Link>
        <form action={publicLogoutAction}>
          <button type="submit" className="session-btn" title="Cerrar sesión">
            Cerrar sesión
          </button>
        </form>
      </div>
    );
  }

  if (!discordEnabled) return null;

  return (
    <Link href={`/api/auth/discord?next=${encodeURIComponent(next)}`} className="session-btn">
      Entrar
    </Link>
  );
}
