import React from 'react';
import { Link } from 'react-router-dom';

export function HomePage() {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-3xl text-center">
                <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    PDF Lecture Service
                </h1>
                <p className="text-xl text-gray-300 mb-12">
                    Transform scientific PDFs into engaging audio lectures with synchronized text highlighting.
                </p>

                <div className="grid md:grid-cols-3 gap-8 mb-12 text-left">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors">
                        <div className="text-3xl mb-4">📄</div>
                        <h3 className="text-xl font-semibold mb-2">Upload PDF</h3>
                        <p className="text-gray-400">Upload any scientific PDF up to 100MB for instant processing.</p>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-purple-500 transition-colors">
                        <div className="text-3xl mb-4">🤖</div>
                        <h3 className="text-xl font-semibold mb-2">Choose Agent</h3>
                        <p className="text-gray-400">Select from multiple presenter personalities to match your style.</p>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-green-500 transition-colors">
                        <div className="text-3xl mb-4">🎧</div>
                        <h3 className="text-xl font-semibold mb-2">Listen & Learn</h3>
                        <p className="text-gray-400">Enjoy synchronized audio with real-time text highlighting.</p>
                    </div>
                </div>

                <Link
                    to="/upload"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-transform hover:scale-105 shadow-lg shadow-blue-500/30"
                >
                    Get Started
                </Link>
            </div>
        </div>
    );
}
