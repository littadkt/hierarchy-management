import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { PwaProvider } from "@/context/PwaContext";
import { PwaInstallGuideModal } from "@/components/PwaInstallGuideModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Team Littad - Task & Order Management",
  description: "Role-based task management, approval hierarchy, inventory, and wholesale ordering system",
  applicationName: "Team Littad",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Team Littad",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Defensive stubs for injected mobile browser / wallet extension scripts
              try {
                if (typeof window !== 'undefined') {
                  if (!window.ethereum) {
                    try { window.ethereum = {}; } catch (_) {}
                  }
                  if (!window.__firefox__) {
                    try { window.__firefox__ = { reader: {} }; } catch (_) {}
                  }
                  try {
                    var __firefox__ = window.__firefox__;
                  } catch (_) {}

                  var isExtensionError = function(msg, src) {
                    var m = String(msg || '');
                    var s = String(src || '');
                    return (
                      m.indexOf('ethereum') !== -1 ||
                      m.indexOf('selectedAddress') !== -1 ||
                      m.indexOf('__firefox__') !== -1 ||
                      m.indexOf('reader') !== -1 ||
                      s.indexOf('extension') !== -1 ||
                      s.indexOf('moz-extension') !== -1 ||
                      s.indexOf('chrome-extension') !== -1 ||
                      s.indexOf('safari-web-extension') !== -1
                    );
                  };

                  var prevOnError = window.onerror;
                  window.onerror = function(message, source, lineno, colno, error) {
                    if (isExtensionError(message, source) || (error && isExtensionError(error.message, ''))) {
                      return true;
                    }
                    if (typeof prevOnError === 'function') {
                      return prevOnError.apply(this, arguments);
                    }
                    return false;
                  };

                  window.addEventListener(
                    'error',
                    function(event) {
                      if (event && (isExtensionError(event.message, event.filename) || (event.error && isExtensionError(event.error.message, '')))) {
                        event.stopImmediatePropagation();
                        event.preventDefault();
                      }
                    },
                    true
                  );

                  window.addEventListener(
                    'unhandledrejection',
                    function(event) {
                      var reason = event && event.reason;
                      var msg = reason ? (reason.message || String(reason)) : '';
                      if (isExtensionError(msg, '')) {
                        event.stopImmediatePropagation();
                        event.preventDefault();
                      }
                    },
                    true
                  );
                }
              } catch (_) {}

              // Theme initialization
              try {
                const storedTheme = localStorage.getItem('theme');
                const storedColor = localStorage.getItem('color-scheme') || 'indigo';
                const isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                const root = document.documentElement;
                if (isDark) {
                  root.classList.add('dark');
                  root.setAttribute('data-theme', 'dark');
                  root.style.colorScheme = 'dark';
                } else {
                  root.classList.remove('dark');
                  root.setAttribute('data-theme', 'light');
                  root.style.colorScheme = 'light';
                }
                root.setAttribute('data-color', storedColor);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="h-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <ConfirmProvider>
                <PwaProvider>
                  <SidebarProvider>
                    {children}
                    <PwaInstallGuideModal />
                  </SidebarProvider>
                </PwaProvider>
              </ConfirmProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
