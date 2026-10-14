/* eslint-env jest */
// Minimal react-native-svg mock. Returns the component name as a string so
// React can render it as a host component stand-in.

const tag = (name: string) => {
  const Comp = () => null;
  Comp.displayName = name;
  return Comp;
};

module.exports = {
  __esModule: true,
  default: tag('Svg'),
  Svg: tag('Svg'),
  Path: tag('Path'),
  Circle: tag('Circle'),
  G: tag('G'),
  Rect: tag('Rect'),
  Text: tag('Text'),
  TSpan: tag('TSpan'),
  Defs: tag('Defs'),
  LinearGradient: tag('LinearGradient'),
  Stop: tag('Stop'),
};
