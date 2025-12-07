import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { createAgent } from '../api/endpoints';
import { ErrorDisplay } from '../components/ErrorDisplay';

export function AgentsPage() {
    const { agents, fetchAgents, addAgent, loading, error } = useAppStore();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [creating, setCreating] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        personality: {
            instructions: '',
            tone: 'casual',
            examples: ''
        },
        voice: {
            voiceId: 'en-US-Neural2-A',
            speed: 1.0,
            pitch: 0
        }
    });

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);

        try {
            // Format examples as array
            const payload = {
                ...formData,
                personality: {
                    ...formData.personality,
                    examples: formData.personality.examples.split('\n').filter(line => line.trim())
                }
            };

            const newAgent = await createAgent(payload);
            addAgent(newAgent);
            setShowCreateForm(false);
            // Reset form
            setFormData({
                name: '',
                description: '',
                personality: {
                    instructions: '',
                    tone: 'casual',
                    examples: ''
                },
                voice: {
                    voiceId: 'en-US-Neural2-A',
                    speed: 1.0,
                    pitch: 0
                }
            });
        } catch (err) {
            setCreateError(err.message || 'Failed to create agent');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Lecture Agents</h1>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        {showCreateForm ? 'Cancel' : 'Create New Agent'}
                    </button>
                </div>

                {showCreateForm && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8 animate-fade-in">
                        <h2 className="text-xl font-semibold mb-4">Create New Agent</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Personality Instructions</label>
                                <textarea
                                    required
                                    value={formData.personality.instructions}
                                    onChange={e => setFormData({ ...formData, personality: { ...formData.personality, instructions: e.target.value } })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white h-24"
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Tone</label>
                                    <select
                                        value={formData.personality.tone}
                                        onChange={e => setFormData({ ...formData, personality: { ...formData.personality, tone: e.target.value } })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="humorous">Humorous</option>
                                        <option value="serious">Serious</option>
                                        <option value="casual">Casual</option>
                                        <option value="formal">Formal</option>
                                        <option value="enthusiastic">Enthusiastic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Voice ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.voice.voiceId}
                                        onChange={e => setFormData({ ...formData, voice: { ...formData.voice, voiceId: e.target.value } })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Speed (0.5 - 2.0)</label>
                                    <input
                                        type="number"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={formData.voice.speed}
                                        onChange={e => setFormData({ ...formData, voice: { ...formData.voice, speed: parseFloat(e.target.value) } })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Pitch (-20 to 20)</label>
                                    <input
                                        type="number"
                                        min="-20"
                                        max="20"
                                        value={formData.voice.pitch}
                                        onChange={e => setFormData({ ...formData, voice: { ...formData.voice, pitch: parseInt(e.target.value) } })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Examples (one per line)</label>
                                <textarea
                                    value={formData.personality.examples}
                                    onChange={e => setFormData({ ...formData, personality: { ...formData.personality, examples: e.target.value } })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white h-24"
                                    placeholder="Why did the photon check into a hotel? Because it was traveling light!"
                                />
                            </div>

                            <ErrorDisplay error={createError} />

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create Agent'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading agents...</p>
                    </div>
                ) : error ? (
                    <ErrorDisplay error={error} onRetry={fetchAgents} />
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents.map(agent => (
                            <div key={agent.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full border border-blue-800">
                                        {agent.personality.tone}
                                    </span>
                                </div>
                                <p className="text-gray-300 mb-4 h-12 overflow-hidden">{agent.description}</p>
                                <div className="text-sm text-gray-500 space-y-1">
                                    <p>Voice: {agent.voice.voiceId}</p>
                                    <p>Speed: {agent.voice.speed}x</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
