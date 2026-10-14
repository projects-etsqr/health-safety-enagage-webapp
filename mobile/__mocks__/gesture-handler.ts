/* eslint-env jest */
// Minimal gesture-handler shim. The real package depends on native bindings.

const passthrough = (props: { children?: unknown }) => props?.children;

module.exports = {
  __esModule: true,
  GestureHandlerRootView: passthrough,
  PanGestureHandler: passthrough,
  TapGestureHandler: passthrough,
  LongPressGestureHandler: passthrough,
  State: {},
  Directions: {},
  gestureHandlerRootHOC: <T,>(c: T) => c,
  Swipeable: passthrough,
  DrawerLayout: passthrough,
  gestureHandlerRootHOC: <T,>(c: T) => c,
};
