import type { PropsWithChildren } from 'react';
import './app.scss';
import { startPerformanceTracking } from './services/telemetry';

startPerformanceTracking();

const App = ({ children }: PropsWithChildren) => children;

export default App;
