import React from 'react';
import { render } from '@testing-library/react-native';
import { Photo } from '../Photo';
import { ThemeProvider } from '@/contexts/theme-context';

// Photo reads useTheme(), so it must render inside ThemeProvider. The provider
// returns null until the persisted theme loads (async-storage jest mock resolves
// on a microtask), so query with findByTestId rather than getByTestId.
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Photo', () => {
  it('renders with a remote source when uri provided', async () => {
    const { findByTestId } = renderWithTheme(
      <Photo uri="https://example.com/a.jpg" testID="p" />,
    );
    expect(await findByTestId('p')).toBeTruthy();
  });
  it('renders a tone placeholder when no uri provided', async () => {
    const { findByTestId } = renderWithTheme(<Photo tone="sunset" testID="p" />);
    expect(await findByTestId('p')).toBeTruthy();
  });
});
