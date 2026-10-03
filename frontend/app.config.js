const productionApiOrigin = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    backendUrl: productionApiOrigin,
  },
});