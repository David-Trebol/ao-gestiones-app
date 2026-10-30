import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo: errorInfo.componentStack || '' });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <AlertTriangle size={32} color={Colors.warning} />
            </View>
            <Text style={styles.title}>
              {this.props.fallbackTitle || 'Algo salió mal'}
            </Text>
            <Text style={styles.message}>
              Ha ocurrido un error inesperado. Puedes intentar recargar esta sección.
            </Text>

            {this.state.error && (
              <ScrollView style={styles.errorBox} horizontal={false}>
                <Text style={styles.errorDetail} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </ScrollView>
            )}

            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.resetBtnPressed]}
              onPress={this.handleReset}
              testID="error-boundary-reset"
            >
              <RotateCcw size={16} color={Colors.white} />
              <Text style={styles.resetBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    maxWidth: 400,
    width: '100%' as any,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    maxHeight: 80,
    width: '100%' as any,
  },
  errorDetail: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: 'monospace',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  resetBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
