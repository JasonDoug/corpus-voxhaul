import apiClient from './client';

// Health Check
export async function checkHealth() {
    const response = await apiClient.get('/health');
    return response.data;
}

// Upload PDF
export async function uploadPDF(file, filename, agentId = null) {
    const base64 = await fileToBase64(file);

    const response = await apiClient.post('/upload', {
        file: base64,
        filename: filename,
        agentId: agentId
    });

    return response.data;
}

// Helper function for file conversion
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove data:application/pdf;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Poll for completion
export async function pollJobStatus(jobId, onUpdate, interval = 5000) {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const status = await getJobStatus(jobId);
                onUpdate(status);

                if (status.status === 'completed') {
                    resolve(status);
                } else if (status.status === 'failed') {
                    reject(new Error(status.error || 'Job failed'));
                } else {
                    setTimeout(poll, interval);
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

// Job Status
export async function getJobStatus(jobId) {
    const response = await apiClient.get(`/status/${jobId}`);
    return response.data;
}

// ...

// Agents
export async function listAgents() {
    const response = await apiClient.get('/agents');
    return response.data.agents;
}

export async function createAgent(agentData) {
    const response = await apiClient.post('/agents', agentData);
    return response.data;
}

// Playback
export async function getPlaybackData(jobId) {
    const response = await apiClient.get(`/playback/${jobId}`);
    return response.data;
}
