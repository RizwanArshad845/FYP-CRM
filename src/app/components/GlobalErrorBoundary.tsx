import React from 'react';
import { ErrorScreen } from './ErrorBoundary';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Global Catch:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen 
          error={this.state.error} 
          onReset={() => this.setState({ hasError: false, error: null })} 
        />
      );
    }

    return this.props.children;
  }
}
