import "./globals.css";

export const metadata = {
  title: "SC Audit Benchmark",
  description: "Generative Solidity Vulnerability Benchmark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
