import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata = {
  title: { default: "Easy Barn Ops", template: "%s · Easy Barn Ops" },
  description: "Operations console for Easy Barn & Bifold Doors",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-ZA" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
