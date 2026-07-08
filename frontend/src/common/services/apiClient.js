const BASE_URL = '';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('shiksha_pilot_token');
  
  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const selectedYearId = localStorage.getItem('shiksha_pilot_academic_year_id');
  if (selectedYearId) {
    headers['X-Academic-Year-Id'] = selectedYearId;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('shiksha_pilot_token');
    localStorage.removeItem('shiksha_pilot_role');
    localStorage.removeItem('shiksha_pilot_user');
    window.location.replace('/login');
    throw new Error('Unauthorized session expired');
  }

  // Handle PDF/blob/excel exports
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/vnd.ms-excel') || contentType.includes('application/octet-stream'))) {
    return response.blob();
  }

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || data.error || 'API Request failed');
    err.data = data.data;
    throw err;
  }

  // Unwrap uniform envelope {status, message, data} → return data field if present
  return Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
