import { apiClient } from './apiClient';

export const authService = {
  async identify(phone) {
    return apiClient.post('/api/auth/identify', { phone });
  },

  async login(phone, password) {
    const data = await apiClient.post('/api/auth/login', { phone, password });
    if (data.token) {
      localStorage.setItem('shiksha_pilot_token', data.token);
      localStorage.setItem('shiksha_pilot_role', data.user.role);
      localStorage.setItem('shiksha_pilot_user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('auth-change'));
    }
    return data;
  },

  async otpLogin(phone, otp, role) {
    const data = await apiClient.post('/api/auth/otp-login', { phone, otp, role });
    if (data.token) {
      localStorage.setItem('shiksha_pilot_token', data.token);
      localStorage.setItem('shiksha_pilot_role', data.user.role || role);
      localStorage.setItem('shiksha_pilot_user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('auth-change'));
    }
    return data;
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

  logout() {
    localStorage.removeItem('shiksha_pilot_token');
    localStorage.removeItem('shiksha_pilot_role');
    localStorage.removeItem('shiksha_pilot_user');
    window.dispatchEvent(new Event('auth-change'));
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
