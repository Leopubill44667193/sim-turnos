import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { negocio } from "@/config";

const accent      = negocio.tema?.accent      ?? '#ef4444'
const accentHover = negocio.tema?.accentHover ?? '#dc2626'
const bg          = negocio.tema?.bg          ?? '#000000'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-title",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  weight: ["300", "400", "500"],
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
});

const isLanding = negocio.id === 'landing'

const metaTitle = isLanding
  ? 'reservaturnos.com.ar — Sistema de reservas online para negocios en Argentina'
  : `${negocio.nombre} — Reservas`

const metaDescription = isLanding
  ? 'Que tus clientes reserven solos, mientras vos atendés. Sistema de reservas online con WhatsApp automático para negocios en Argentina.'
  : `Reservá tu turno en ${negocio.nombre}. ${negocio.recursos.length} ${negocio.recursoNombre.toLowerCase()}s · Turnos de ${negocio.duracionMinutos} min · ${negocio.direccion}.`

export const metadata: Metadata = {
  title: metaTitle,
  description: metaDescription,
  openGraph: {
    title: metaTitle,
    description: metaDescription,
    siteName: isLanding ? 'reservaturnos.com.ar' : negocio.nombre,
    locale: "es_AR",
    type: "website",
    images: [{ url: `/og-image-${negocio.id}.jpg`, width: 1024, height: 1024 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${negocio.fontTitle ? bebasNeue.variable : ""} ${inter.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <meta name="facebook-domain-verification" content="tr0qkmbqr9zrskrr2i1togkqe9qaq5" />
        <style>{`:root { --accent: ${accent}; --accent-hover: ${accentHover}; --bg: ${bg};${negocio.fontTitle ? ` --font-title: '${negocio.fontTitle}', sans-serif;` : ""} }`}</style>
      </head>
      <body className="min-h-full flex flex-col">
        {negocio.bgTexture === "grid" && (
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none -z-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(74,222,128,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,.05) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        )}
        {children}
        {negocio.id !== 'landing' && (
          <footer className="py-3 text-center text-xs text-white/20">
            {negocio.direccionCorta ?? negocio.direccion}
          </footer>
        )}
      </body>
    </html>
  );
}
