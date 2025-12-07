import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobStatus } from '../api/endpoints';

export function StatusPage() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let intervalId;

        const fetchStatus = async () => {
            try {
                const data = await getJobStatus(jobId);
                setStatus(data);

                if (data.status === 'completed') {
                    clearInterval(intervalId);
                } else if (data.status === 'failed') {
                    clearInterval(intervalId);
                    setError(data.error || 'Processing failed');
                }
            } catch (err) {
                setError(err.message);
                clearInterval(intervalId);
            }
        };

        fetchStatus();
        intervalId = setInterval(fetchStatus, 5000);

        return () => clearInterval(intervalId);
    }, [jobId]);

    if (error) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white flex flex-col items-center justify-center p-6">
                <div className="bg-red-900/20 border border-red-500 p-8 rounded-xl max-w-md w-full text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold mb-2 text-red-400">Processing Error</h1>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/upload')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-xl text-gray-400">Loading status...</p>
                </div>
            </div>
        );
    }

    const getStatusIcon = (stageStatus) => {
        switch (stageStatus) {
            case 'completed': return '✓';
            case 'in_progress': return '⟳';
            case 'failed': return '✗';
            default: return '○';
        }
    };

    const getStatusColor = (stageStatus) => {
        switch (stageStatus) {
            case 'completed': return 'text-green-400 border-green-400 bg-green-400/10';
            case 'in_progress': return 'text-blue-400 border-blue-400 bg-blue-400/10 animate-pulse';
            case 'failed': return 'text-red-400 border-red-400 bg-red-400/10';
            default: return 'text-gray-600 border-gray-600 bg-gray-800';
        }
    };

    const getProgressPercentage = () => {
        if (!status.stages) return 0;
        const completed = status.stages.filter(s => s.status === 'completed').length;
        return (completed / status.stages.length) * 100;
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-6 flex flex-col items-center">
            <div className="w-full max-w-3xl">
                <h1 className="text-3xl font-bold mb-8">Processing Status</h1>

                <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-sm text-gray-400">File Name</p>
                            <p className="font-medium truncate">{status.pdfFilename}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Job ID</p>
                            <p className="font-mono text-sm truncate text-gray-300">{status.jobId}</p>
                        </div>
                    </div>

                    <div className="mb-2 flex justify-between items-end">
                        <span className="text-sm font-medium uppercase tracking-wider text-gray-400">Overall Progress</span>
                        <span className="text-xl font-bold text-blue-400">{Math.round(getProgressPercentage())}%</span>
                    </div>
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                            style={{ width: `${getProgressPercentage()}%` }}
                        ></div>
                    </div>
                </div>

                <div className="space-y-4">
                    {status.stages && status.stages.map((stage, index) => (
                        <div key={index} className={`flex items-center p-4 rounded-lg border ${getStatusColor(stage.status).replace('animate-pulse', '')} bg-opacity-10`}>
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center mr-4 font-bold ${getStatusColor(stage.status)}`}>
                                {getStatusIcon(stage.status)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-semibold capitalize text-lg">{stage.stage.replace(/_/g, ' ')}</h3>
                                    <span className={`text-sm font-medium uppercase ${stage.status === 'in_progress' ? 'text-blue-400' : stage.status === 'completed' ? 'text-green-400' : 'text-gray-500'}`}>
                                        {stage.status.replace('_', ' ')}
                                    </span>
                                </div>
                                {stage.startedAt && (
                                    <p className="text-xs text-gray-500">
                                        Started: {new Date(stage.startedAt).toLocaleTimeString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {status.status === 'completed' && (
                    <div className="mt-8 text-center">
                        <button
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-full text-xl shadow-lg shadow-green-500/30 transition-transform hover:scale-105"
                            onClick={() => navigate(`/player/${jobId}`)}
                        >
                            View Lecture
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
