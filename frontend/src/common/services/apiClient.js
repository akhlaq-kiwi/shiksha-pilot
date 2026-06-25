const BASE_URL = '';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('bn_school_token');
  
  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
    localStorage.removeItem('bn_school_token');
    localStorage.removeItem('bn_school_role');
    localStorage.removeItem('bn_school_user');
    window.dispatchEvent(new Event('auth-change'));
    throw new Error('Unauthorized session expired');
  }

  // Handle PDF/blob exports
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return response.blob();
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API Request failed');
  }

  return data;
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
