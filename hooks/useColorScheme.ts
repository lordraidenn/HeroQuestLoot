import { useColorScheme as _useColorScheme } from 'react-native';

/**
 * Gibt die aktuelle Farbeinstellung des Systems zurück: 'light' oder 'dark'.
 */
export function useColorScheme() {
  return _useColorScheme();
}
