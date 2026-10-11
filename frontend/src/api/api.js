// TraceX API Client — DBMS Phase
// Centralized API calls for all TraceX features.

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

export const TOKEN_KEY             = 'tracex_token';
export const USER_KEY              = 'tracex_user';
export const EXTENSION_CONNECTED_KEY = 'tracex_extension_connected';

async function request(endpoint, options = {}) {
  const url     = `${API_BASE_URL}${endpoint}`;
  const headers = options.headers || {};

  // Attach JWT token if present
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Choose a reasonable timeout strategy for Render cold starts (45s)
  // without making the UI hang indefinitely. Callers can override via options.timeout.
  const timeoutMs = typeof options.timeout === 'number' ? options.timeout : 45_000;
  const timeoutSeconds = Math.round(timeoutMs / 1000);

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let removeCallerListener = null;
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw options.signal.reason || new DOMException('The user aborted a request.', 'AbortError');
    }
    const onCallerAbort = () => {
      controller.abort(options.signal.reason);
    };
    options.signal.addEventListener('abort', onCallerAbort, { once: true });
    removeCallerListener = () => options.signal.removeEventListener('abort', onCallerAbort);
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutSeconds}s — backend may be waking up. Please retry.`);
    }
    if (options.signal?.aborted) {
      throw options.signal.reason || err;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (removeCallerListener) {
      removeCallerListener();
    }
  }

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // ── Authentication ─────────────────────────────────────────
  login: async (credentials) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  register: async (userData) => {
    const user = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    const loginData = await api.login({
      email:    userData.email,
      password: userData.password,
    });
    return loginData;
  },

  getMe:    () => request('/api/auth/me'),
  logout:   () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getCurrentUser: () => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  getToken:       () => localStorage.getItem(TOKEN_KEY),
  setCurrentUser: (user, token) => {
    if (user)  localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(TOKEN_KEY, token);
  },

  // ── Tracking & Extension State ─────────────────────────────
  getTrackingStatus:   () => request('/api/activity-logs/tracking-status'),
  setTrackingStatus:   (isPaused) => request('/api/activity-logs/tracking-status', {
    method: 'POST',
    body: JSON.stringify({ is_paused: isPaused }),
  }),
  sendHeartbeat:       (payload = {}) => request('/api/activity-logs/extension-heartbeat', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  autoConnectTraceX:   () => request('/api/activity-logs/auto-connect', { method: 'POST' }),
  getExtensionDownloadUrl: () => `${API_BASE_URL}/api/extension/download`,

  // ── Live Activity ──────────────────────────────────────────
  getCurrentActivity:  () => request('/api/activity-logs/current'),

  // ── Activity Logs ──────────────────────────────────────────
  getTodayActivities:  () => request('/api/activity-logs/today'),
  getActivities:       (limit = 100) => request(`/api/activity-logs?limit=${limit}`),
  getTimeline:         (date) => request(`/api/activity-logs/timeline${date ? `?target_date=${date}` : ''}`),

  // ── Browser History ───────────────────────────────────────
  getBrowserHistory:   (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search)     qs.set('search',     params.search);
    if (params.domain)     qs.set('domain',     params.domain);
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date)   qs.set('end_date',   params.end_date);
    if (params.limit)      qs.set('limit',      params.limit);
    if (params.offset)     qs.set('offset',     params.offset);
    const query = qs.toString();
    return request(`/api/activity-logs/history${query ? `?${query}` : ''}`);
  },

  // ── Activity Analytics ─────────────────────────────────────
  getActivityTodaySummary: () => request('/api/activity-logs/analytics/today'),
  getActivityHourly:       (date) => request(`/api/activity-logs/analytics/hourly${date ? `?target_date=${date}` : ''}`),
  getActivityDomains:      (days = 7) => request(`/api/activity-logs/analytics/domains?days=${days}`),
  getActivityDailyTrend:   (days = 7) => request(`/api/activity-logs/analytics/daily-trend?days=${days}`),
  getDbmsDemo:             () => request('/api/activity-logs/analytics/dbms-demo'),

  // ── Courses ───────────────────────────────────────────────
  getCourses:    ()              => request('/api/courses'),
  getCourse:     (id)            => request(`/api/courses/${id}`),
  createCourse:  (data)          => request('/api/courses',        { method: 'POST', body: JSON.stringify(data) }),
  updateCourse:  (id, data)      => request(`/api/courses/${id}`,  { method: 'PUT',  body: JSON.stringify(data) }),
  deleteCourse:  (id)            => request(`/api/courses/${id}`,  { method: 'DELETE' }),

  // ── Topics ────────────────────────────────────────────────
  getTopicsByCourse: (courseId)  => request(`/api/topics/course/${courseId}`),
  getTopic:      (id)            => request(`/api/topics/${id}`),
  createTopic:   (data)          => request('/api/topics',         { method: 'POST', body: JSON.stringify(data) }),
  updateTopic:   (id, data)      => request(`/api/topics/${id}`,   { method: 'PUT',  body: JSON.stringify(data) }),
  deleteTopic:   (id)            => request(`/api/topics/${id}`,   { method: 'DELETE' }),

  // ── Resources ─────────────────────────────────────────────
  getResources: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.domain) qs.set('domain', params.domain);
    if (params.resource_type) qs.set('resource_type', params.resource_type);
    if (params.sort_by) qs.set('sort_by', params.sort_by);
    if (params.limit) qs.set('limit', params.limit);
    const query = qs.toString();
    return request(`/api/resources${query ? `?${query}` : ''}`);
  },
  getResourcesByCourse:  (id)    => request(`/api/resources/course/${id}`),
  getResourcesByTopic:   (id)    => request(`/api/resources/topic/${id}`),
  createResource: (data)         => request('/api/resources',      { method: 'POST', body: JSON.stringify(data) }),
  deleteResource: (id)           => request(`/api/resources/${id}`,{ method: 'DELETE' }),

  // ── Documents ─────────────────────────────────────────────
  uploadDocument:       (formData) => request('/api/documents/upload', { method: 'POST', body: formData }),
  getDocument:          (id)       => request(`/api/documents/${id}`),
  deleteDocument:       (id)       => request(`/api/documents/${id}`,  { method: 'DELETE' }),
  getDocumentsByCourse: (id)       => request(`/api/documents/course/${id}`),
  getDocumentsByTopic:  (id)       => request(`/api/documents/topic/${id}`),

  // ── Study Sessions ────────────────────────────────────────
  getStudySessions:        ()      => request('/api/study-sessions'),
  getStudySessionsByCourse:(id)    => request(`/api/study-sessions/course/${id}`),
  startStudySession: (data)        => request('/api/study-sessions/start',      { method: 'POST', body: JSON.stringify(data) }),
  endStudySession:   (id, data={}) => request(`/api/study-sessions/${id}/end`,  { method: 'POST', body: JSON.stringify(data) }),

  // ── Progress ──────────────────────────────────────────────
  getProgressByTopic:  (id)       => request(`/api/progress/topic/${id}`),
  getProgressByCourse: (id)       => request(`/api/progress/course/${id}`),
  createProgress: (data)          => request('/api/progress',        { method: 'POST', body: JSON.stringify(data) }),
  updateProgress: (id, data)      => request(`/api/progress/${id}`,  { method: 'PUT',  body: JSON.stringify(data) }),

  // ── Course Analytics ──────────────────────────────────────
  getOverview:             ()     => request('/api/analytics/overview'),
  getCourseAnalytics:      (id)   => request(`/api/analytics/course/${id}`),
  getWeeklyAnalytics:      ()     => request('/api/analytics/weekly'),
  getStudyTimeBreakdown:   ()     => request('/api/analytics/study-time'),
  getProgressAnalytics:    ()     => request('/api/analytics/progress'),
  getUnstudiedResources:   ()     => request('/api/analytics/unstudied-resources'),

  // ── Notes ─────────────────────────────────────────────────
  getNotesByCourse: (id)          => request(`/api/notes/course/${id}`),
  getNotesByTopic:  (id)          => request(`/api/notes/topic/${id}`),
  getNote:    (id)                => request(`/api/notes/${id}`),
  createNote: (data)              => request('/api/notes',           { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data)          => request(`/api/notes/${id}`,     { method: 'PUT',  body: JSON.stringify(data) }),
  deleteNote: (id)                => request(`/api/notes/${id}`,     { method: 'DELETE' }),

  // ── History-to-Plan ───────────────────────────────────────
  getHistoryToPlan: ()            => request('/api/history-to-plan'),
};
