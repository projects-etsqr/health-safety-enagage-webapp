/* eslint-env jest */
// Minimal reanimated mock — the full RN-reanimated package is too heavy for unit tests.

module.exports = {
  __esModule: true,
  default: {
    createAnimatedComponent: (c: unknown) => c,
    Value: function () {
      return { setValue: () => {}, interpolate: () => ({}), addListener: () => {} };
    },
    View: 'AnimatedView',
    Text: 'AnimatedText',
    Image: 'AnimatedImage',
    ScrollView: 'AnimatedScrollView',
  },
  useSharedValue: (v: unknown) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withTiming: (v: unknown) => v,
  withSpring: (v: unknown) => v,
  Easing: { linear: () => 0, ease: () => 0, inOut: () => 0 },
  runOnJS: (fn: (...a: unknown[]) => unknown) => fn,
  runOnUI: (fn: (...a: unknown[]) => unknown) => fn,
};
