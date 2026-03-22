import axios from 'axios';

const API_URL = '/api/auth';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authenticatedApi = api;

// Add a request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth services
const register = async (userData: any) => {
  // Default JSON submission
  const response = await axios.post(`${API_URL}/register`, userData);
  return response.data;
};

const login = async (userData: any) => {
  const response = await axios.post(`${API_URL}/login`, userData);
  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

const loginWithGoogle = async (credential: string, role?: string) => {
  const response = await axios.post(`${API_URL}/google`, { credential, ...(role ? { role } : {}) });
  if (response.data) {
    // Normalize legacy 'user' role to 'artisan' so the dashboard renders
    const userData = { ...response.data };
    if (userData.role === 'user') userData.role = 'artisan';
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  }
  return response.data;
};

const adminLogin = async (secretKey: string) => {
  const response = await axios.post(`${API_URL}/admin/login`, { secretKey });
  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

const createSubAdmin = async (payload: any) => {
  const response = await axios.post(`${API_URL}/admin/subadmins`, payload);
  return response.data;
};

const logout = () => {
  localStorage.removeItem('user');
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user') || 'null');
};

const checkEmailAvailable = async (email: string): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_URL}/check-email`, { params: { email } });
    // available: true = free to use, available: false = already taken
    return response.data?.available === true;
  } catch {
    // On network/API error, assume available - backend will validate on submit
    return true;
  }
};

const checkPhoneAvailable = async (phone: string): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_URL}/check-phone`, { params: { phone } });
    return response.data?.available === true;
  } catch {
    return true;
  }
};

const authService = {
  register,
  login,
  loginWithGoogle,
  adminLogin,
  logout,
  getCurrentUser,
  checkEmailAvailable,
  checkPhoneAvailable,
  forgotPassword: async (email: string) => {
    const response = await axios.post(`${API_URL}/forgot`, { email });
    return response.data;
  },
  checkResetOptions: async (email: string): Promise<{ hasVerifiedPhone: boolean }> => {
    const response = await axios.post(`${API_URL}/check-reset-options`, { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await axios.post(`${API_URL}/reset`, { token, password });
    return response.data;
  },
  getPendingManufacturers: async () => {
    const response = await api.get(`/auth/admin/manufacturers/pending`);
    return response.data;
  },
  approveManufacturer: async (id: string) => {
    const response = await api.post(`/auth/admin/manufacturers/${id}/approve`);
    return response.data;
  },
  rejectManufacturer: async (id: string, reason: string) => {
    const response = await api.post(`/auth/admin/manufacturers/${id}/decline`, { reason });
    return response.data;
  },
  listUsers: async () => {
    const response = await api.get(`/auth/admin/users`);
    return response.data;
  },
  suspendUser: async (id: string) => {
    const response = await api.post(`/auth/admin/users/${id}/suspend`);
    return response.data;
  },
  activateUser: async (id: string) => {
    const response = await api.post(`/auth/admin/users/${id}/activate`);
    return response.data;
  },
  deleteUser: async (id: string) => {
    const response = await api.delete(`/auth/admin/users/${id}`);
    return response.data;
  },
  createSubAdmin,
  getCertificationFile: async (id: string): Promise<Blob> => {
    const response = await api.get(`/auth/admin/manufacturers/${id}/certification`, {
      responseType: 'blob',
    });
    return response.data;
  },
  updateProfile: async (profileData: any) => {
    const response = await api.put(`/auth/profile`, profileData);
    return response.data;
  },
  verifyEmail: async (token: string) => {
    const response = await axios.post(`${API_URL}/verify-email`, { token });
    return response.data;
  },
  sendPhoneVerification: async (phone: string) => {
    const response = await api.post(`/auth/phone/send-verification`, { phone });
    return response.data;
  },
  verifyPhone: async (code: string) => {
    const response = await api.post(`/auth/phone/verify`, { code });
    return response.data;
  },
  forgotPasswordPhone: async (email: string) => {
    const response = await axios.post(`${API_URL}/phone/forgot`, { email });
    return response.data;
  },
  resetPasswordPhone: async (emailOrPhone: string, code: string, password: string) => {
    // emailOrPhone can be an email (new flow) or phone (legacy)
    const isEmail = emailOrPhone.includes('@');
    const payload = isEmail
      ? { email: emailOrPhone, code, password }
      : { phone: emailOrPhone, code, password };
    const response = await axios.post(`${API_URL}/phone/reset`, payload);
    return response.data;
  },
  requestEmailChange: async (newEmail: string) => {
    const response = await api.post('/auth/change-email', { newEmail });
    return response.data;
  },
  confirmEmailChange: async (code: string) => {
    const response = await api.post('/auth/confirm-email-change', { code });
    return response.data;
  },
  updatePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    const response = await api.post('/auth/update-password', payload);
    return response.data;
  },
  subAdminForgotPassword: async (email: string) => {
    const response = await axios.post(`${API_URL}/sub-admin/forgot`, { email });
    return response.data;
  },
  resetSubAdminPassword: async (id: string) => {
    const response = await api.post(`/auth/admin/subadmins/${id}/reset-password`);
    return response.data;
  },
};

export default authService;
