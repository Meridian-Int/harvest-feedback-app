import { useTheme } from '../../app/ThemeProvider';
import { Icon } from '../icons';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return <IconButton label={`Switch to ${next} theme`} onClick={() => setTheme(next)}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></IconButton>;
}
