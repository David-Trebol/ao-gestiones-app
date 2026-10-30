import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  contentMaxWidth: number;
  gridColumns: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;
    const isMobile = width < 768;

    const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : width;
    const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;

    return {
      width,
      height,
      isDesktop,
      isTablet,
      isMobile,
      contentMaxWidth,
      gridColumns,
    };
  }, [width, height]);
}
