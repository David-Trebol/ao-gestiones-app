import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Loader, Truck, CheckCircle, XCircle } from 'lucide-react-native';
import { OrderStatus } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface StatusConfig {
  label: string;
  shortLabel: string;
  bgKey: 'statusPendingBg' | 'statusProcessingBg' | 'statusShippedBg' | 'statusDeliveredBg' | 'statusCancelledBg';
  textKey: 'statusPendingText' | 'statusProcessingText' | 'statusShippedText' | 'statusDeliveredText' | 'statusCancelledText';
}

const statusConfig: Record<OrderStatus, StatusConfig> = {
  pending: {
    label: 'Pendiente',
    shortLabel: 'Pend.',
    bgKey: 'statusPendingBg',
    textKey: 'statusPendingText',
  },
  processing: {
    label: 'Procesando',
    shortLabel: 'Proc.',
    bgKey: 'statusProcessingBg',
    textKey: 'statusProcessingText',
  },
  shipped: {
    label: 'Enviado',
    shortLabel: 'Env.',
    bgKey: 'statusShippedBg',
    textKey: 'statusShippedText',
  },
  delivered: {
    label: 'Entregado',
    shortLabel: 'Entreg.',
    bgKey: 'statusDeliveredBg',
    textKey: 'statusDeliveredText',
  },
  cancelled: {
    label: 'Cancelado',
    shortLabel: 'Canc.',
    bgKey: 'statusCancelledBg',
    textKey: 'statusCancelledText',
  },
};

const iconMap = {
  pending: Clock,
  processing: Loader,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

interface Props {
  status: OrderStatus;
  size?: 'sm' | 'default';
}

export default React.memo(function StatusBadge({ status, size = 'default' }: Props) {
  const { colors } = useTheme();
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = iconMap[status] || Clock;
  const isSmall = size === 'sm';
  const bg = colors[config.bgKey];
  const textColor = colors[config.textKey];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: textColor,
          borderWidth: 0,
          paddingHorizontal: isSmall ? 7 : 11,
          paddingVertical: isSmall ? 3 : 5,
        },
      ]}
      testID={`status-badge-${status}`}
    >
      <Icon size={isSmall ? 10 : 13} color={textColor} />
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {isSmall ? config.shortLabel : config.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
  },
  text: {
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
});
