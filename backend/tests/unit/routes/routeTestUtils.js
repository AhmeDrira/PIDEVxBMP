const findRouteLayer = (router, method, path) => {
  const wantedMethod = method.toLowerCase();
  return router.stack.find(
    (layer) => layer.route && layer.route.path === path && layer.route.methods[wantedMethod]
  );
};

const getRouteHandlers = (router, method, path) => {
  const wantedMethod = method.toLowerCase();
  const layer = findRouteLayer(router, method, path);
  if (!layer) return [];
  return layer.route.stack
    .filter((entry) => !entry.method || entry.method === wantedMethod)
    .map((entry) => entry.handle);
};

module.exports = {
  findRouteLayer,
  getRouteHandlers,
};
