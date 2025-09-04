// src/app/layout.tsx
import { auth } from "@auth/authJs";
import clsx from "clsx";
// ⛔️ อย่า import SessionProvider ตรง ๆ ใน server component
import "src/styles/index.css";
import "src/styles/splash-screen.css";
import "../../public/assets/fonts/Geist/geist.css";
import "../../public/assets/fonts/material-design-icons/MaterialIconsOutlined.css";
import "../../public/assets/fonts/meteocons/style.css";
import "../../public/assets/styles/prism.css";
import generateMetadata from "../utils/generateMetadata";
import App from "./App";
import Providers from "./providers";

// eslint-disable-next-line react-refresh/only-export-components
export const metadata = await generateMetadata({
  title: "QR Code - YTRC",
  description: "QR Code - YTRC - NextJS by apiwat.s",
  cardImage: "/card.png",
  robots: "follow, index",
  favicon: "/favicon.ico",
  url: "https://react-material.fusetheme.com",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // กันเคส JWTSessionError / “no matching decryption secret”
  let session: any = null;
  try {
    session = await auth();
  } catch (e) {
    console.warn("[RootLayout] auth() failed, continue as unauthenticated");
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#000000" />
        <base href="/" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <noscript id="emotion-insertion-point" />
      </head>
      <body id="root" className={clsx("loading")}>
        <Providers session={session}>
          <App>{children}</App>
        </Providers>
      </body>
    </html>
  );
}
