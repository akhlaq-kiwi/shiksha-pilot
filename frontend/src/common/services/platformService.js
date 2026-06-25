import { apiClient } from './apiClient';

export const platformService = {
  async getSchools() {
    return apiClient.get('/api/platform/schools');
  },

  async createSchool(schoolData) {
    return apiClient.post('/api/platform/schools', schoolData);
  },

  async inviteSchool(inviteData) {
    return apiClient.post('/api/platform/invitations', inviteData);
  },

  async updateSchool(id, schoolData) {
    return apiClient.put(`/api/platform/schools/${id}`, schoolData);
  },

  async extendSubscription(id, extendData) {
    return apiClient.post(`/api/platform/schools/${id}/extend`, extendData);
  },

  async deleteSchool(id) {
    return apiClient.delete(`/api/platform/schools/${id}`);
  },

  async getPlans() {
    return apiClient.get('/api/platform/plans');
  },

  async getSubscriptions() {
    return apiClient.get('/api/platform/subscriptions');
  },

  async getAuditLogs() {
    return apiClient.get('/api/platform/subscription/audit-logs');
  },

  async getStats() {
    return apiClient.get('/api/platform/stats');
  },

  async getAdmins() {
    return apiClient.get('/api/platform/admins');
  },

  async createAdmin(data) {
    return apiClient.post('/api/platform/admins', data);
  },
};
