import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import api from '../services/api.js';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../hooks/useAuth', () => () => ({
  connectAndCheck: jest.fn(),
}));

jest.mock('../services/api.js', () => ({
  post: jest.fn(),
}));

jest.mock('../config', () => ({
  googleClientId: 'test-google-client-id.apps.googleusercontent.com',
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

function emailInput() {
  return screen.getByPlaceholderText('you@example.com');
}

function passwordInput() {
  return document.querySelector('input[type="password"]');
}

function submitButton() {
  return document.querySelector('button[type="submit"]');
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
  window.google = {
    accounts: {
      id: {
        initialize: jest.fn(),
        renderButton: jest.fn((container) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Continue with Google';
          container.appendChild(button);
        }),
      },
    },
  };
});

test('login form renders email and password fields', () => {
  renderLogin();

  expect(emailInput()).toBeInTheDocument();
  expect(passwordInput()).toBeInTheDocument();
});

test('submitting with both fields empty displays required validation', async () => {
  renderLogin();

  await userEvent.click(submitButton());

  expect(screen.getByText('Please enter a valid email.')).toBeInTheDocument();
  expect(screen.getByText('Password is required.')).toBeInTheDocument();
});

test('empty email displays the configured email validation error', async () => {
  renderLogin();

  await userEvent.type(passwordInput(), 'Password123!');
  await userEvent.click(submitButton());

  expect(screen.getByText('Please enter a valid email.')).toBeInTheDocument();
  expect(screen.queryByText('Password is required.')).not.toBeInTheDocument();
});

test('empty password displays password-required error', async () => {
  renderLogin();

  await userEvent.type(emailInput(), 'client@example.com');
  await userEvent.click(submitButton());

  expect(screen.getByText('Password is required.')).toBeInTheDocument();
});

test('invalid email format displays the configured validation error', async () => {
  renderLogin();

  await userEvent.type(emailInput(), 'not-an-email');
  await userEvent.type(passwordInput(), 'Password123!');
  await userEvent.click(submitButton());

  expect(screen.getByText('Please enter a valid email.')).toBeInTheDocument();
});

test('valid form values allow login submission and dashboard redirection', async () => {
  api.post.mockResolvedValueOnce({
    data: {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: { id: 1, email: 'client@example.com', role: 'client' },
    },
  });
  renderLogin();

  await userEvent.type(emailInput(), 'Client@Example.com');
  await userEvent.type(passwordInput(), 'Password123!');
  await userEvent.click(submitButton());

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'client@example.com',
      password: 'Password123!',
      loginRole: 'client',
    });
  });
  expect(localStorage.getItem('access_token')).toBe('access-token');
  expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
});

test('Google login button renders when configured', async () => {
  const googleScript = document.createElement('script');
  googleScript.src = 'https://accounts.google.com/gsi/client';
  document.body.appendChild(googleScript);
  renderLogin();

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});

test('loading state disables submit button while login request is pending', async () => {
  api.post.mockImplementationOnce(() => new Promise(() => {}));
  renderLogin();

  await userEvent.type(emailInput(), 'client@example.com');
  await userEvent.type(passwordInput(), 'Password123!');
  await userEvent.click(submitButton());

  expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
});

test('API error message is displayed when login fails', async () => {
  api.post.mockRejectedValueOnce({
    response: { data: { detail: { message: 'Invalid email or password' } } },
  });
  renderLogin();

  await userEvent.type(emailInput(), 'client@example.com');
  await userEvent.type(passwordInput(), 'WrongPassword123!');
  await userEvent.click(submitButton());

  expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
});


