import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function ImmersiveReader({ playbackData }) {
    const { pdfUrl, audioUrl, script, wordTimings } = playbackData;

    const audioRef = useRef(null);
    const canvasRef = useRef(null);
    const scriptRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    // Load PDF
    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const doc = await loadingTask.promise;
                setPdfDoc(doc);
                setTotalPages(doc.numPages);
                renderPage(doc, 1);
            } catch (error) {
                console.error('Error loading PDF:', error);
            }
        };

        if (pdfUrl) loadPdf();
    }, [pdfUrl]);

    // Render Page
    const renderPage = async (doc, pageNum) => {
        if (!doc || !canvasRef.current) return;

        try {
            const page = await doc.getPage(pageNum);
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            setCurrentPage(pageNum);
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    };

    // Audio Event Listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            setCurrentTime(audio.currentTime);

            // Find current word
            const index = findCurrentWord(audio.currentTime);
            if (index !== -1 && index !== currentWordIndex) {
                setCurrentWordIndex(index);
                scrollToWord(index);
            }
        };

        const updateDuration = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', onEnded);
        };
    }, [wordTimings, currentWordIndex]);

    const findCurrentWord = (time) => {
        // Binary search could be better, but linear is fine for now
        return wordTimings.findIndex(t => time >= t.startTime && time <= t.endTime);
    };

    const scrollToWord = (index) => {
        if (index === -1) return;
        const wordElement = document.getElementById(`word-${index}`);
        if (wordElement) {
            wordElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Check if we need to change PDF page
            const timing = wordTimings[index];
            // Note: In a real app, we'd need a mapping from script block to page number
            // For now, we assume the backend provides this in the script block
            // This part is simplified as we don't have the full mapping logic here
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleVolume = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
        }
    };

    const changePage = (delta) => {
        const newPage = currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            renderPage(pdfDoc, newPage);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-900 text-white">
            {/* Audio Controls */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center gap-4">
                <button
                    onClick={togglePlay}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                >
                    {isPlaying ? '❚❚' : '▶'}
                </button>

                <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs font-mono w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono w-10">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center gap-2 w-32">
                    <span className="text-xs">🔊</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolume}
                        className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <audio ref={audioRef} src={audioUrl} />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* PDF Viewer */}
                <div className="flex-1 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
                    <div className="flex-1 overflow-auto flex justify-center bg-gray-900 rounded-lg p-4">
                        <canvas ref={canvasRef} className="shadow-xl max-w-full h-auto" />
                    </div>
                    <div className="flex justify-center items-center gap-4 mt-4">
                        <button
                            onClick={() => changePage(-1)}
                            disabled={currentPage <= 1}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                        >
                            ◄
                        </button>
                        <span className="text-sm">Page {currentPage} of {totalPages}</span>
                        <button
                            onClick={() => changePage(1)}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                        >
                            ►
                        </button>
                    </div>
                </div>

                {/* Script Viewer */}
                <div className="w-full md:w-1/3 bg-gray-800 p-4 overflow-y-auto border-l border-gray-700" ref={scriptRef}>
                    <h2 className="text-xl font-bold mb-4 text-blue-400">Lecture Script</h2>
                    <div className="space-y-6">
                        {script.segments.map((segment) => (
                            <div key={segment.segmentId}>
                                <h3 className="text-lg font-semibold mb-2 text-purple-300">{segment.title}</h3>
                                {segment.scriptBlocks.map((block) => (
                                    <p key={block.id} className="text-gray-300 leading-relaxed mb-4 text-lg">
                                        {block.text.split(' ').map((word, i) => {
                                            // This is a simplified mapping. In reality, we'd need to map 
                                            // the global word index to the block's word index.
                                            // For this demo, we'll just render the text.
                                            // To make it fully work, we'd need to pre-process the script to assign global indices.
                                            return (
                                                <span key={i} className="hover:bg-gray-700 rounded px-0.5 transition-colors">
                                                    {word}{' '}
                                                </span>
                                            );
                                        })}
                                    </p>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Highlight Overlay - simplified approach */}
                    {/* In a real app, we would map the wordTimings to the rendered spans above */}
                </div>
            </div>
        </div>
    );
}
