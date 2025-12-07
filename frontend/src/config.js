export const API_CONFIG = {
    baseURL: import.meta.env.VITE_API_URL || '/api', // Use env var for prod, proxy for dev
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
};

export const API_KEY = 'rB5y5sScAKN3Ndoec3sq3iHQiaUpSt07A1XVuFYd';
