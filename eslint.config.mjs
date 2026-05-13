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
      "atx-mongo/no-mongo-collection-writes-outside-data-plane": "error",
      "atx-mongo/no-suspicious-save-outside-data-plane": "error"
    }
  }
];

export default config;
