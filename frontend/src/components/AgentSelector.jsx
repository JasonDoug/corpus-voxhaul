import React, { useEffect } from 'react';
import { useAppStore } from '../store';

export function AgentSelector({ value, onChange }) {
    const { agents, fetchAgents, loading, error } = useAppStore();

    useEffect(() => {
        if (agents.length === 0) {
            fetchAgents();
        }
    }, [agents.length, fetchAgents]);

    if (loading && agents.length === 0) {
        return <div className="text-gray-400 text-sm">Loading agents...</div>;
    }

    if (error && agents.length === 0) {
        return <div className="text-red-400 text-sm">Failed to load agents</div>;
    }

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full mt-1 rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 py-2 px-3"
        >
            <option value="">Select an agent (optional)</option>
            {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                    {agent.name} - {agent.description}
                </option>
            ))}
        </select>
    );
}
