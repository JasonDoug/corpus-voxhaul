import React from 'react';

export function ErrorDisplay({ error, onRetry, onDismiss }) {
    if (!error) return null;

    // Handle both string errors and object errors
    let errorMessage = typeof error === 'string' ? error : error.message || 'An unknown error occurred';
    if (typeof error === 'object' && error.response && error.response.data && error.response.data.message) {
        errorMessage += ` (${error.response.data.message})`;
    }
    const errorCode = typeof error === 'object' ? error.code : null;
    const retryable = typeof error === 'object' ? error.retryable : true;

    return (
        <div className="bg-red-900/50 border border-red-500 text-red-100 px-4 py-3 rounded relative my-4" role="alert">
            <div className="flex items-start">
                <div className="py-1">
                    <svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="font-bold">Error</p>
                    <p className="text-sm">{errorMessage}</p>
                    {errorCode && <p className="text-xs mt-1 font-mono opacity-75">Code: {errorCode}</p>}
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                {retryable && onRetry && (
                    <button
                        onClick={onRetry}
                        className="bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm transition-colors"
                    >
                        Retry
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="bg-transparent hover:bg-red-900/30 text-red-100 font-semibold py-1 px-3 rounded text-sm border border-red-800 transition-colors"
                    >
                        Dismiss
                    </button>
                )}
            </div>
        </div>
    );
}
