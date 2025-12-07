import { Component, ErrorInfo, ReactNode, useEffect } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Здесь можно отправить ошибку в систему мониторинга (Sentry, etc.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  useEffect(() => {
    const webApp = (window as any).Telegram?.WebApp;
    if (webApp) {
      webApp.MainButton.setText('Вернуться на главную');
      webApp.MainButton.show();
      webApp.MainButton.onClick(onReset);

      return () => {
        webApp.MainButton.hide();
        webApp.MainButton.offClick(onReset);
      };
    }
  }, [onReset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-destructive/5 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center border border-border">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-foreground mb-4">Что-то пошло не так</h1>
        <p className="text-muted-foreground mb-6">
          Произошла непредвиденная ошибка. Мы уже работаем над её исправлением.
        </p>
        
        {import.meta.env.DEV && error && (
          <details className="mt-4 text-left bg-muted rounded-lg p-4 mb-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground mb-2">
              Детали ошибки (только в режиме разработки)
            </summary>
            <pre className="text-xs text-destructive overflow-auto max-h-40">
              {error.toString()}
              {errorInfo?.componentStack}
            </pre>
          </details>
        )}

        <button
          onClick={onReset}
          className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}

export default ErrorBoundary;

