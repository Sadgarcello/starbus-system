import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Khawaja Club UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper-soft px-4 text-center">
          <img src="/khawaja-club-logo.png" alt="Khawaja Club" className="h-20 w-20 rounded-full" />
          <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
          <p className="max-w-md text-sm text-ink-muted">
            Refresh the page. If it keeps happening, message your teacher or admin.
          </p>
          <Button type="button" onClick={() => window.location.assign('/')}>
            Reload Khawaja Club
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
