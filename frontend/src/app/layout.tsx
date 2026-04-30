import "./globals.css";
import TopNav from "./components/TopNav";

export const metadata = {
  title: "Yoda Market",
  description: "Escrow marketplace dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="bg-grid" />
          <TopNav />
          <main className="container page-wrap">{children}</main>
        </div>
      </body>
    </html>
  );
}