const BASE_URL = '';

// Concurrency queue to prevent blasting the server with dozens of simultaneous requests
const MAX_CONCURRENT_REQUESTS = 4;
let activeRequestsCount = 0;
const requestQueue = [];

function dequeue() {
  if (activeRequestsCount >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }
  activeRequestsCount++;
  const nextTask = requestQueue.shift();
  nextTask();
}

function runWithConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push(() => {
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeRequestsCount--;
          dequeue();
        });
    });
    dequeue();
  });
}

// In-flight GET request deduplication
const inFlightGetMap = new Map();

async function executeFetch(endpoint, options = {}, attempt = 1) {
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

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (networkErr) {
    // If a transient network glitch or connection reset occurs, retry once
    if (attempt < 3 && (!options.method || options.method === 'GET')) {
      await new Promise(r => setTimeout(r, attempt * 400));
      return executeFetch(endpoint, options, attempt + 1);
    }
    throw networkErr;
  }

  // Handle 429 Too Many Requests with automatic backoff and retry (up to 3 attempts)
  if (response.status === 429 && attempt < 3) {
    const backoffDelay = attempt * 500 + Math.floor(Math.random() * 200);
    await new Promise(r => setTimeout(r, backoffDelay));
    return executeFetch(endpoint, options, attempt + 1);
  }

  if (response.status === 401) {
    localStorage.removeItem('shiksha_pilot_token');
    localStorage.removeItem('shiksha_pilot_role');
    localStorage.removeItem('shiksha_pilot_user');
    
    let errorMsg = '';
    try {
      const data = await response.clone().json();
      errorMsg = data?.message || data?.error || '';
    } catch (_) {}

    const isInactive = errorMsg.toLowerCase().includes('inactive');
    if (isInactive) {
      const finalMsg = errorMsg || 'You have been marked as Inactive please contact Shiksha Pilot Team for for more details';
      sessionStorage.setItem('login_error_message', finalMsg);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace(`/login?error=${encodeURIComponent(finalMsg)}`);
      }
    } else {
      sessionStorage.removeItem('login_error_message');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }
    throw new Error(errorMsg || 'Unauthorized. Please log in.');
  }

  if (response.status === 403) {
    let errorMsg = '';
    try {
      const data = await response.clone().json();
      errorMsg = data?.message || data?.error || '';
    } catch (_) {}

    if (errorMsg.includes('No role assigned') || errorMsg.includes('No menu permissions')) {
      localStorage.removeItem('shiksha_pilot_token');
      localStorage.removeItem('shiksha_pilot_role');
      localStorage.removeItem('shiksha_pilot_user');
      localStorage.removeItem('cached_school_profile');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
      throw new Error(errorMsg || 'Access Denied. Permissions revoked.');
    }
  }

  // Handle PDF/blob/excel exports
  const contentType = response.headers.get('content-type') || '';
  if (contentType && (
    contentType.includes('application/pdf') || 
    contentType.includes('application/vnd.ms-excel') || 
    contentType.includes('application/vnd.openxmlformats') || 
    contentType.includes('spreadsheetml') || 
    contentType.includes('application/octet-stream') || 
    contentType.includes('excel')
  )) {
    return response.blob();
  }

  // Safe JSON extraction: avoids "Unexpected end of JSON input" on empty bodies or HTML error pages
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch (_) {
      data = null;
    }
  }

  if (!response.ok) {
    const fallbackMsg = response.status === 429
      ? 'Too many requests. Please wait a moment and try again.'
      : `API Request failed (HTTP ${response.status})`;
    const err = new Error(data?.message || data?.error || fallbackMsg);
    err.status = response.status;
    err.data = data?.data;
    throw err;
  }

  if (data === null || data === undefined) {
    return null;
  }

  // Unwrap uniform envelope {status, message, data} → return data field if present
  return Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;
}

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // Deduplicate identical in-flight GET requests
  if (method === 'GET') {
    const token = localStorage.getItem('shiksha_pilot_token') || '';
    const selectedYearId = localStorage.getItem('shiksha_pilot_academic_year_id') || '';
    const dedupKey = `${endpoint}::${selectedYearId}::${token}`;

    if (inFlightGetMap.has(dedupKey)) {
      return inFlightGetMap.get(dedupKey);
    }

    const promise = runWithConcurrencyLimit(() => executeFetch(endpoint, options))
      .finally(() => {
        inFlightGetMap.delete(dedupKey);
      });

    inFlightGetMap.set(dedupKey, promise);
    return promise;
  }

  // Non-GET requests run through the concurrency queue
  return runWithConcurrencyLimit(() => executeFetch(endpoint, options));
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, bodyOrOptions = {}) => {
    if (bodyOrOptions && (bodyOrOptions.data !== undefined || bodyOrOptions.body !== undefined)) {
      const body = bodyOrOptions.body !== undefined ? bodyOrOptions.body : bodyOrOptions.data;
      const { data, body: unused, ...restOptions } = bodyOrOptions;
      return request(endpoint, { ...restOptions, method: 'DELETE', body });
    }
    return request(endpoint, { ...bodyOrOptions, method: 'DELETE' });
  },
};

export default apiClient;
