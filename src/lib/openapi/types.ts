export type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

export type OpenApiSchema = {
  $ref?: string;
  type?: string;
  description?: string;
  format?: string;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  enum?: string[];
  additionalProperties?: boolean | OpenApiSchema;
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  nullable?: boolean;
  example?: unknown;
};

export type OpenApiMediaType = {
  schema?: OpenApiSchema;
  examples?: Record<string, { summary?: string; value: unknown }>;
};

export type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
};

export type OpenApiResponse = {
  description: string;
  content?: Record<string, OpenApiMediaType>;
};

export type OpenApiRequestBody = {
  description?: string;
  required?: boolean;
  content: Record<string, OpenApiMediaType>;
};

export type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
};

export type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>;

export type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, OpenApiPathItem>;
  components?: {
    securitySchemes?: Record<
      string,
      {
        type: "apiKey" | "http" | "oauth2" | "openIdConnect";
        in?: "query" | "header" | "cookie";
        name?: string;
        scheme?: string;
        bearerFormat?: string;
        description?: string;
      }
    >;
    schemas?: Record<string, OpenApiSchema>;
  };
};
