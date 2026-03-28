import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "../../atx-docs/design-system/atxfinance-brand-kit.css";
import "./globals.css";

const XF_THEME_BOOT = `(function(){
  function resolve(pref){
    var light=false;
    try{light=window.matchMedia("(prefers-color-scheme: light)").matches;}catch(e){}
    if(pref==="system")return light?"soft":"deep";
    if(pref==="light")return "soft";
    return "deep";
  }
  try{
    var raw=localStorage.getItem("xf-ui-theme")||"dark";
    if(raw!=="light"&&raw!=="dark"&&raw!=="system")raw="dark";
    document.documentElement.setAttribute("data-xf-ui",resolve(raw));
    document.documentElement.setAttribute("data-xf-theme-pref",raw);
  }catch(e){}
})();`;

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "aTx Trusted Advisory",
  description:
    "aTx⚡Finance — Powered by xAI. No Atoms Moved. Just Gains Earned. Options workspace, xChat, and portfolio tools."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`dark ${inter.variable}`} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: XF_THEME_BOOT }} id="xf-ui-theme-boot" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
