import { BrowserRouter } from 'react-router-dom';
import { IconSymbols } from '../components/icons';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import { AppRoutes } from './routes';

export function App() {
  return <BrowserRouter><ThemeProvider><AuthProvider><IconSymbols /><AppRoutes /></AuthProvider></ThemeProvider></BrowserRouter>;
}
