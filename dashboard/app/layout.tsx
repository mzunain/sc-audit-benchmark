import "./globals.css";
import { Inter } from "next/font/google";
import { Nav } from "./nav";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "SC Audit Benchmark",
  description:
    "Evidence-first model selection for Solidity vulnerability scanning, cost-adjusted audit workflows, and LLM benchmark analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased text-stone-900 bg-stone-50">
        <Nav />
        {children}
      </body>
    </html>
  );
}
