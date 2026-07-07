import { apiClient } from './apiClient';

export const authService = {
  async identify(phone) {
    return apiClient.post('/api/auth/identify', { phone });
  },

  async login(phone, password) {
    const payload = await apiClient.post('/api/auth/login', { phone, password });
    if (payload?.token) {
      localStorage.setItem('shiksha_pilot_token', payload.token);
      localStorage.setItem('shiksha_pilot_role', payload.user.role);
      localStorage.setItem('shiksha_pilot_user', JSON.stringify(payload.user));
      window.dispatchEvent(new Event('auth-change'));
    }
    return payload;
  },



  async forgotPassword(phone) {
    return apiClient.post('/api/auth/forgot-password', { phone });
  },

  async verifyOtp(phone, otp) {
    return apiClient.post('/api/auth/verify-otp', { phone, otp });
  },

  async resetPassword(phone, otp, newPassword) {
    return apiClient.post('/api/auth/reset-password', { phone, otp, new_password: newPassword });
  },

  async changePassword(newPassword) {
    return apiClient.post('/api/auth/change-password', { new_password: newPassword });
  },

  logout() {
    localStorage.removeItem('shiksha_pilot_token');
    localStorage.removeItem('shiksha_pilot_role');
    localStorage.removeItem('shiksha_pilot_user');
    window.dispatchEvent(new Event('auth-change'));
    window.location.replace('/login');
  },

  isAuthenticated() {
    return !!localStorage.getItem('shiksha_pilot_token');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('shiksha_pilot_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  getUserRole() {
    return localStorage.getItem('shiksha_pilot_role') || '';
  }
};
