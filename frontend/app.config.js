const RELEASE_API_ORIGIN = "https://micro-genius-3.emergentapps.tr";
const configuredApiOrigin = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
const isReleaseBuild = process.env.APP_VARIANT === "production";

if (isReleaseBuild && configuredApiOrigin !== RELEASE_API_ORIGIN) {
  throw new Error("Production build requires the verified HTTPS API origin.");
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    backendUrl: isReleaseBuild ? RELEASE_API_ORIGIN : configuredApiOrigin,
  },
});