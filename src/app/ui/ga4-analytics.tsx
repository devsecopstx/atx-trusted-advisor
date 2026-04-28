"use client";

import Script from "next/script";

type Ga4AnalyticsProps = {
  measurementId: string;
};

export function Ga4Analytics({ measurementId }: Ga4AnalyticsProps) {
  const id = measurementId.trim();
  if (!id) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
