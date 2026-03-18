import packageJson from "../../package.json";

type PackageJsonShape = {
  version?: string;
};

const metadata = packageJson as PackageJsonShape;

export const APP_VERSION = metadata.version?.trim() || "0.0.0";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
