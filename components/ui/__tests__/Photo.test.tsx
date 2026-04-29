import React from 'react';
import { render } from '@testing-library/react-native';
import { Photo } from '../Photo';

describe('Photo', () => {
  it('renders with a remote source when uri provided', () => {
    const { getByTestId } = render(<Photo uri="https://example.com/a.jpg" testID="p" />);
    expect(getByTestId('p')).toBeTruthy();
  });
  it('renders a tone placeholder when no uri provided', () => {
    const { getByTestId } = render(<Photo tone="sunset" testID="p" />);
    expect(getByTestId('p')).toBeTruthy();
  });
});
