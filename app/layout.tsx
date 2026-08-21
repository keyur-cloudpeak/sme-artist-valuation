export const metadata = {
  title: "Sony Music | M&A Catalog Valuation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
