import type { PropsWithChildren } from 'react';
import './app.scss';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPerformanceTracking } from './services/telemetry';

startPerformanceTracking();

const App = ({ children }: PropsWithChildren) => <ErrorBoundary>{children}</ErrorBoundary>;

export default App;
