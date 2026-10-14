// Compatibility shim so existing `import { Ionicons } from '@expo/vector-icons'`
// statements keep working on bare React Native (no Expo). Babel's
// module-resolver aliases '@expo/vector-icons' to this file.
export { default as Ionicons } from 'react-native-vector-icons/Ionicons';
export { default as MaterialIcons } from 'react-native-vector-icons/MaterialIcons';
export { default as MaterialCommunityIcons } from 'react-native-vector-icons/MaterialCommunityIcons';
export { default as FontAwesome } from 'react-native-vector-icons/FontAwesome';
export { default as Feather } from 'react-native-vector-icons/Feather';
