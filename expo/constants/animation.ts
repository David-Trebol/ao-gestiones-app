import { Platform } from 'react-native';

/** En web no existe el driver nativo de animaciones: usarlo solo en iOS/Android evita avisos */
export const NATIVE_DRIVER = Platform.OS !== 'web';
