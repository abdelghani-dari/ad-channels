import type { Metadata } from "next";
import { Inter, Roboto_Flex } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  axes: ["opsz", "wdth"],
});

export const metadata: Metadata = {
  title: "AbdelGhani Dari — Moroccan Live TV",
  description: "Live Moroccan television and beIN Sports streaming hub.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoFlex.variable} dark antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(/Tizen|SMART-TV|SmartTV|Maple|Web0S|webOS|NetCast|HbbTV|VIDAA|BRAVIA|TV Safari|SamsungBrowser\\/[\\d.]+.*\\bTV\\b/i.test(navigator.userAgent))document.documentElement.classList.add("tv-browser")}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-black font-sans text-zinc-100 selection:bg-emerald-700 selection:text-white">
        {children}
      </body>
    </html>
  );
}
