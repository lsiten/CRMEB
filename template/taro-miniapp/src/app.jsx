import './app.scss';
import { ErrorBoundary } from './components/ErrorBoundary';

const App = ({ children }) => <ErrorBoundary>{children}</ErrorBoundary>;

export default App;
