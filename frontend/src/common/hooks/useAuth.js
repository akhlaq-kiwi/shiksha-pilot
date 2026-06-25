import { authService } from '../services/authService';

export function useAuth() {
  return {
    user: authService.getCurrentUser(),
    role: authService.getUserRole(),
    isAuthenticated: authService.isAuthenticated(),
    logout: authService.logout,
  };
}
