import { SwaggerApiDocs } from "./swagger-ui";

export default function AdminApiDocsPage() {
  return (
    <section className="admin-page-stack">
      <header>
        <h1>API Documentation</h1>
        <p>
          OpenAPI current-state inventory for internal architecture review. Endpoint coverage is
          complete for active route handlers; payload schemas are intentionally broad.
        </p>
      </header>
      <SwaggerApiDocs specUrl="/api/openapi" />
    </section>
  );
}
