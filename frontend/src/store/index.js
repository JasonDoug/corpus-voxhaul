import { create } from 'zustand';
import { uploadPDF, listAgents } from '../api/endpoints';

export const useAppStore = create((set, get) => ({
    // Jobs state
    jobs: [],
    currentJob: null,

    // Agents state
    agents: [],
    selectedAgent: '',

    // UI state
    loading: false,
    error: null,

    // Actions
    setJobs: (jobs) => set({ jobs }),
    addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
    setCurrentJob: (job) => set({ currentJob: job }),

    setAgents: (agents) => set({ agents }),
    addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
    setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    // Async actions
    uploadPDF: async (file, agentId) => {
        set({ loading: true, error: null });
        try {
            const result = await uploadPDF(file, file.name, agentId);
            get().addJob(result);
            return result.jobId;
        } catch (error) {
            set({ error: error.message || 'Upload failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    fetchAgents: async () => {
        set({ loading: true, error: null });
        try {
            const agents = await listAgents();
            set({ agents });
        } catch (error) {
            set({ error: error.message || 'Failed to fetch agents' });
        } finally {
            set({ loading: false });
        }
    },
}));
