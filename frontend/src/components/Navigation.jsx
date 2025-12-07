import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'text-blue-400' : 'text-gray-300 hover:text-white';
    };

    return (
        <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0">
                            <span className="text-xl font-bold text-white">PDF Lecture Service</span>
                        </Link>
                        <div className="hidden md:block">
                            <div className="ml-10 flex items-baseline space-x-4">
                                <Link to="/" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/')}`}>
                                    Home
                                </Link>
                                <Link to="/upload" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/upload')}`}>
                                    Upload
                                </Link>
                                <Link to="/agents" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/agents')}`}>
                                    Agents
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
