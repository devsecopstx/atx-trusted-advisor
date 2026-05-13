import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

import { atxMongoDataPlane } from "./eslint-rules/atx-mongo-data-plane.mjs";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      "atx-mongo": atxMongoDataPlane
    },
    rules: {
      "atx-mongo/no-mongo-client-import-outside-lib": "error",
      "atx-mongo/no-collection-write-in-app-api-routes": "error"
    }
  }
];

export default config;
