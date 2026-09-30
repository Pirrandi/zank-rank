import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "./site-footer";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zank.lol"),
  title: "zank.rank",
  description:
    "Ranking de League of Legends para tu grupo: rango, LP y rachas desde Riot, apuestas, muros y un bot de Discord con IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${bricolage.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
