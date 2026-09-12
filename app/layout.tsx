import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@coreui/coreui/dist/css/coreui.min.css";
import "@coreui/chartjs/dist/css/coreui-chartjs.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-app",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MCP Panel",
    template: "%s · MCP Panel",
  },
  description: "MCP sunucularını yöneten Bootstrap tabanlı kontrol paneli.",

  // The icons come from the app/icon.svg and app/favicon.ico file conventions. Declaring
  // them again here would override both and mean managing them by hand.
  applicationName: "MCP Panel",
};

/**
 * Writes the theme and the language onto <html> before hydration.
 *
 * The theme applies at once — it is only an attribute. For language, this sets `lang` and
 * nothing more: the text itself arrives after hydration through the locale store, so the
 * server and the client agree on the first render.
 */
const bootScript = `(function(){try{var t=localStorage.getItem("mcp-theme")||"light";document.documentElement.dataset.coreuiTheme=t;var l=localStorage.getItem("mcp-locale");if(l==="tr"||l==="en"){document.documentElement.lang=l;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      data-coreui-theme="light"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
