import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('landing page sign-in button redirects to login page', async () => {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

  await userEvent.click(screen.getAllByRole('button', { name: /sign in/i })[0]);

  expect(mockNavigate).toHaveBeenCalledWith('/login');
});
