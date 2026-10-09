import { applyTheme, readTheme } from './theme';

it('defaults to dark and restores a saved light choice', () => {
  expect(readTheme()).toBe('dark'); localStorage.setItem('harvest-theme', 'light'); expect(readTheme()).toBe('light');
  localStorage.setItem('harvest-theme', 'invalid'); expect(readTheme()).toBe('dark');
});
it('applies and persists the theme', () => { applyTheme('light'); expect(document.documentElement.dataset.theme).toBe('light'); expect(readTheme()).toBe('light'); });
it('works when browser persistence is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }); expect(readTheme()).toBe('dark');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); }); applyTheme('light'); expect(document.documentElement.dataset.theme).toBe('light');
});
