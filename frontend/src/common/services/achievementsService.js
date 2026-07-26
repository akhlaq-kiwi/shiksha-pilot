import { apiClient } from './apiClient';

export const achievementsService = {
  async getAchievements(params = {}) {
    const res = await apiClient.get('/api/school/achievements', { params });
    return res.data || res;
  },

  async getAchievementReportCard(achievementId) {
    const res = await apiClient.get(`/api/school/achievements/${achievementId}/report-card`);
    return res.data || res;
  }
};
