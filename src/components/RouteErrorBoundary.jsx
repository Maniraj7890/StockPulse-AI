import { Component } from 'react';

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, lastResetKey: props.resetKey ?? 'initial' };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props, state) {
    if ((props.resetKey ?? 'initial') !== state.lastResetKey) {
      return {
        hasError: false,
        lastResetKey: props.resetKey ?? 'initial',
      };
    }

    return null;
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error(`Route render failed for ${this.props.pageName ?? 'unknown page'}:`, error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel p-6">
          <p className="metric-label">Page Error</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">Unable to render this page</h2>
          <p className="mt-3 text-sm text-slate-400">
            The app shell is still active. Please try another page or refresh the current route.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
