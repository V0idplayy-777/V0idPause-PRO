import { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { MediaPanel } from './components/MediaPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { Timeline } from './components/Timeline';
import { InspectorPanel } from './components/InspectorPanel';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { StatusBar } from './components/StatusBar';
import { useStore } from './store/useStore';
import './styles/app.css';

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { setPlaying, playing } = useStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying(!playing);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playing, setPlaying]);

  const handleNewProject = () => {
    if (confirm('Start a new project? Unsaved changes will be lost.')) {
      window.location.reload();
    }
  };

  return (
    <div className="app-root">
      <TopBar
        onExport={() => setShowExport(true)}
        onOpenSettings={() => setShowSettings(true)}
        onNewProject={handleNewProject}
      />

      <div className="app-workspace">
        <aside className="sidebar left-sidebar">
          <MediaPanel />
        </aside>

        <main className="center-column">
          <div className="preview-area">
            <PreviewPanel />
          </div>
          <div className="timeline-area">
            <Timeline />
          </div>
        </main>

        <aside className="sidebar right-sidebar">
          <InspectorPanel />
        </aside>
      </div>

      <StatusBar />
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
