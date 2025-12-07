import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { AgentSelector } from '../components/AgentSelector';
import { ErrorDisplay } from '../components/ErrorDisplay';

export function UploadPage() {
    const navigate = useNavigate();
    const { uploadPDF, loading, error, setError } = useAppStore();

    const [file, setFile] = useState(null);
    const [agentId, setAgentId] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const handleFileChange = (selectedFile) => {
        if (!selectedFile) return;

        // Validate file
        if (selectedFile.size > 100 * 1024 * 1024) {
            setError({ message: 'File size must be under 100MB', retryable: false });
            return;
        }
        if (selectedFile.type !== 'application/pdf') {
            setError({ message: 'File must be a PDF', retryable: false });
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            setError({ message: 'Please select a file', retryable: false });
            return;
        }

        try {
            const jobId = await uploadPDF(file, agentId || null);
            navigate(`/status/${jobId}`);
        } catch (err) {
            // Error is handled in store
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <h1 className="text-3xl font-bold mb-8 text-center">Upload PDF</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Drag and Drop Area */}
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500 bg-gray-800'}
              ${file ? 'border-green-500 bg-green-500/10' : ''}
            `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {file ? (
                            <div className="file-info">
                                <div className="text-4xl mb-2">📄</div>
                                <p className="text-lg font-medium">{file.name}</p>
                                <p className="text-sm text-gray-400 mb-4">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                    className="text-red-400 hover:text-red-300 text-sm font-medium underline"
                                >
                                    Remove File
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-4xl mb-4 text-gray-500">☁️</div>
                                <p className="text-lg mb-2">Drag and drop your PDF here</p>
                                <p className="text-sm text-gray-500 mb-4">or</p>
                                <label className="inline-block">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => handleFileChange(e.target.files[0])}
                                        disabled={loading}
                                        className="hidden"
                                    />
                                    <span className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
                                        Choose File
                                    </span>
                                </label>
                            </>
                        )}
                    </div>

                    {/* Agent Selection */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Lecture Agent (Optional)</label>
                        <AgentSelector value={agentId} onChange={setAgentId} />
                        <p className="text-xs text-gray-500 mt-2">
                            Select an agent to customize the lecture style, or leave empty for default
                        </p>
                    </div>

                    {/* Error Display */}
                    <ErrorDisplay
                        error={error}
                        onRetry={() => handleSubmit({ preventDefault: () => { } })}
                        onDismiss={() => setError(null)}
                    />

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!file || loading}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all
              ${!file || loading
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/20'}
            `}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            'Upload and Process'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
