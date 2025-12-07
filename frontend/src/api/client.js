import axios from 'axios';
import { API_CONFIG, API_KEY } from '../config';

const apiClient = axios.create(API_CONFIG);

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add API Key
        config.headers['x-api-key'] = API_KEY;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle errors globally
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default apiClient;
