import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata = {
  title: "Lemma — AI Mathematics Research",
  description: "A private, local workspace for auditable, AI-assisted mathematics research.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
