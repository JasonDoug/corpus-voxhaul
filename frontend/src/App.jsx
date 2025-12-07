import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { HomePage } from './pages/HomePage';
import { UploadPage } from './pages/UploadPage';
import { StatusPage } from './pages/StatusPage';
import { AgentsPage } from './pages/AgentsPage';
import { PlayerPage } from './pages/PlayerPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/status/:jobId" element={<StatusPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/player/:jobId" element={<PlayerPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
