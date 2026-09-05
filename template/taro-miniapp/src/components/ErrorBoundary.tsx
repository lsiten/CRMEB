import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Text, View } from '@tarojs/components';

type ErrorBoundaryProps = Readonly<{ children: ReactNode }>;
type ErrorBoundaryState = Readonly<{ hasError: boolean }>;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public readonly state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Taro 页面渲染异常', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <View className='page card error'>
        <Text>页面暂时无法显示</Text>
        <Button size='mini' onClick={this.handleRetry}>重试</Button>
      </View>
    );
  }
}
