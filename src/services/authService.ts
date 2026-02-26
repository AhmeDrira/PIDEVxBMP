import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

// Create axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  // If certificationFile is a File, submit multipart/form-data
  if (userData.certificationFile && typeof (userData.certificationFile as any).name === 'string') {
    const form = new FormData();
    Object.entries(userData).forEach(([key, value]) => {
      if (key === 'certificationFile' && value) {
        form.append('certificationFile', value as File);
      } else if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    });
    const response = await axios.post(`${API_URL}/register`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  }
  // Default JSON submission
  const response = await axios.post(`${API_URL}/register`, userData);
  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

const login = async (userData: any) => {
  const response = await axios.post(`${API_URL}/login`, userData);
  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
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
  logout,
  getCurrentUser,
  checkEmailAvailable,
  checkPhoneAvailable,
  forgotPassword: async (email: string) => {
    const response = await axios.post(`${API_URL}/forgot`, { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await axios.post(`${API_URL}/reset`, { token, password });
    return response.data;
  },
  createAdmin: async (adminData: any) => {
    const response = await axios.post(`${API_URL}/admin/create`, adminData);
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
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
  getCertificationFile: async (id: string): Promise<Blob> => {
    const response = await api.get(`/auth/admin/manufacturers/${id}/certification`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default authService;
