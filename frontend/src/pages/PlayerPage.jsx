import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPlaybackData } from '../api/endpoints';
import { ImmersiveReader } from '../components/ImmersiveReader';

export function PlayerPage() {
    const { jobId } = useParams();
    const [playbackData, setPlaybackData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadPlaybackData() {
            try {
                const data = await getPlaybackData(jobId);
                setPlaybackData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadPlaybackData();
    }, [jobId]);

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-xl text-gray-400">Loading lecture experience...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white flex items-center justify-center">
                <div className="bg-red-900/20 border border-red-500 p-8 rounded-xl max-w-md w-full text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold mb-2 text-red-400">Error Loading Lecture</h1>
                    <p className="text-gray-300">{error}</p>
                </div>
            </div>
        );
    }

    return <ImmersiveReader playbackData={playbackData} />;
}
