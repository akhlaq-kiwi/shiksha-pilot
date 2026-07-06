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

  async createPlan(data) {
    return apiClient.post('/api/platform/plans', data);
  },

  async updatePlan(id, data) {
    return apiClient.put(`/api/platform/plans/${id}`, data);
  },

  async deletePlan(id) {
    return apiClient.delete(`/api/platform/plans/${id}`);
  },

  async getSchoolTeachers(id) {
    return apiClient.get(`/api/platform/schools/${id}/teachers`);
  },

  async getSchoolStudents(id) {
    return apiClient.get(`/api/platform/schools/${id}/students`);
  },

  async getSchoolSubscriptions(id) {
    return apiClient.get(`/api/platform/schools/${id}/subscriptions`);
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

  async getGrowthChart() {
    return apiClient.get('/api/platform/growth-chart');
  },

  async getSchoolStats(id) {
    return apiClient.get(`/api/platform/schools/${id}/stats`);
  },

  async getAdmins() {
    return apiClient.get('/api/platform/admins');
  },

  async createAdmin(data) {
    return apiClient.post('/api/platform/admins', data);
  },
};
