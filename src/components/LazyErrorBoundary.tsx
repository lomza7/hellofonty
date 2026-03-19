import { Component, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

export default class LazyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.message.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError';

    return { hasError: true, isChunkError };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {this.state.isChunkError
                ? 'Mise à jour disponible'
                : 'Une erreur est survenue'}
            </h2>
            <p className="text-gray-600 mb-8">
              {this.state.isChunkError
                ? 'Une nouvelle version du site est disponible. Veuillez rafraîchir la page pour continuer.'
                : 'Un problème est survenu lors du chargement de cette page. Veuillez réessayer.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
              >
                Rafraîchir la page
              </button>
              {!this.state.isChunkError && (
                <button
                  onClick={this.handleRetry}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Réessayer
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
