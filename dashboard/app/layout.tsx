import "./globals.css";
import { Inter } from "next/font/google";
import { Nav } from "./nav";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "Solidity Vulnerability Benchmark",
  description: "Three open-weight model philosophies tested on LLM-generated vulnerable Solidity contracts.",
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
