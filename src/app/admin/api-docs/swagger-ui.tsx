"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false
});

type SwaggerApiDocsProps = {
  specUrl: string;
};

export function SwaggerApiDocs({ specUrl }: SwaggerApiDocsProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)"
      }}
    >
      <SwaggerUI
        url={specUrl}
        defaultModelsExpandDepth={0}
        displayRequestDuration
        docExpansion="list"
      />
    </div>
  );
}
