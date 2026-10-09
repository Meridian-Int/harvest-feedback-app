import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../app/AuthProvider';
import { ThemeProvider } from '../app/ThemeProvider';
import { IconSymbols } from '../components/icons';
import type { AuthUser } from '../lib/types';
import type { Theme } from '../lib/theme';

export function renderWithProviders(ui: ReactElement, options: { route?: string; theme?: Theme; user?: AuthUser | null } = {}) {
  return {
    ...render(<MemoryRouter initialEntries={[options.route ?? '/']}><ThemeProvider initialTheme={options.theme}><AuthProvider initialUser={options.user}><IconSymbols />{ui}</AuthProvider></ThemeProvider></MemoryRouter>),
    user: userEvent.setup(),
  };
}
