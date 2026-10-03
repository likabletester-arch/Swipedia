// Android/iOS production bundles must never inherit a preview or platform-default API origin.
const RELEASE_API_ORIGIN = "https://micro-genius-3.emergentapps.tr";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    backendUrl: RELEASE_API_ORIGIN,
  },
});