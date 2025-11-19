import type { Metadata } from "next";
import { Montserrat, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.goclegal.com"),
  title: {
    default: "GOC Legal — Oakland Personal Injury & Auto Accident Lawyer",
    template: "%s | GOC Legal",
  },
  description:
    "Top-rated Oakland personal injury lawyer helping accident victims recover maximum compensation. Free consultations. No fees until we win.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    siteName: "GOC Legal",
    images: ["/og-default.jpg"], // put in /public
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-default.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${cormorantGaramond.variable} antialiased`}
      >
        {children}
      </body>
      {/* Google Tag (gtag.js) */}
      <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=AW-17444498530`}
        />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17444498530');
          `}
        </Script>
        {/* Live Chat Script  */}
        <Script id="live-chat" src="https://app.livechatai.com/embed.js" data-id="cmg7bwm430003l404hl3ixvxf" async defer></Script>
    </html>
  );
}
