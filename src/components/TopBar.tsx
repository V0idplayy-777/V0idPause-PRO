import { useState } from 'react';
import {
  Film, Save, FolderOpen, Plus, Undo2, Redo2, Settings,
  ChevronDown, Download, FileVideo, Scissors, Magnet, ZoomIn, ZoomOut,
  Hand, MousePointer2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Tool } from '../types';

interface TopBarProps {
  onExport: () => void;
  onOpenSettings: () => void;
  onNewProject: () => void;
}

const TOOL_ITEMS: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: 'select', icon: <MousePointer2 size={15} />, label: 'Selection', shortcut: 'V' },
  { id: 'razor', icon: <Scissors size={15} />, label: 'Razor', shortcut: 'C' },
  { id: 'hand', icon: <Hand size={15} />, label: 'Hand', shortcut: 'H' },
  { id: 'zoom', icon: <ZoomIn size={15} />, label: 'Zoom', shortcut: 'Z' },
];

import React from 'react';

export const TopBar: React.FC<TopBarProps> = ({ onExport, onOpenSettings, onNewProject }) => {
  const { name, setProjectName, selectedTool, setSelectedTool, undo, redo, undoStack, redoStack, zoom, setZoom, snapEnabled, setSnapEnabled, fps } = useStore();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);

  const handleNameBlur = () => {
    setEditingName(false);
    setProjectName(nameVal || 'Untitled Project');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="app-logo">
          <Film size={18} className="logo-icon" />
          <span className="logo-text">V0idpause</span>
          <span className="logo-pro">PRO</span>
        </div>

        <div className="topbar-divider" />

        <div className="menu-group" onMouseLeave={() => setFileMenuOpen(false)}>
          <button className="menu-btn" onClick={() => setFileMenuOpen(v => !v)}>
            File <ChevronDown size={12} />
          </button>
          {fileMenuOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => { onNewProject(); setFileMenuOpen(false); }}>
                <Plus size={14} /> New Project
              </button>
              <button className="dropdown-item">
                <FolderOpen size={14} /> Open Project
              </button>
              <button className="dropdown-item">
                <Save size={14} /> Save
              </button>
              <div className="dropdown-sep" />
              <button className="dropdown-item" onClick={() => { onExport(); setFileMenuOpen(false); }}>
                <Download size={14} /> Export Media
              </button>
            </div>
          )}
        </div>

        <button className="menu-btn">Edit <ChevronDown size={12} /></button>
        <button className="menu-btn">Clip <ChevronDown size={12} /></button>
        <button className="menu-btn">Sequence <ChevronDown size={12} /></button>
        <button className="menu-btn">View <ChevronDown size={12} /></button>
      </div>

      <div className="topbar-center">
        {editingName ? (
          <input
            className="project-name-input"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
            autoFocus
          />
        ) : (
          <button className="project-name-btn" onClick={() => setEditingName(true)}>
            {name}
          </button>
        )}
        <span className="fps-badge">{fps} fps · 1920×1080</span>
      </div>

      <div className="topbar-right">
        <div className="tool-group">
          {TOOL_ITEMS.map(t => (
            <button
              key={t.id}
              className={`tool-btn ${selectedTool === t.id ? 'active' : ''}`}
              onClick={() => setSelectedTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="topbar-divider" />

        <button
          className={`icon-btn ${snapEnabled ? 'active' : ''}`}
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="Toggle Snap"
        >
          <Magnet size={15} />
        </button>

        <div className="zoom-group">
          <button className="icon-btn" onClick={() => setZoom(zoom - 20)} title="Zoom Out"><ZoomOut size={14} /></button>
          <span className="zoom-label">{Math.round(zoom)}px/s</span>
          <button className="icon-btn" onClick={() => setZoom(zoom + 20)} title="Zoom In"><ZoomIn size={14} /></button>
        </div>

        <div className="topbar-divider" />

        <button
          className={`icon-btn ${undoStack.length === 0 ? 'disabled' : ''}`}
          onClick={undo}
          title={`Undo (${undoStack[undoStack.length - 1]?.label || ''})`}
          disabled={undoStack.length === 0}
        >
          <Undo2 size={15} />
        </button>
        <button
          className={`icon-btn ${redoStack.length === 0 ? 'disabled' : ''}`}
          onClick={redo}
          title="Redo"
          disabled={redoStack.length === 0}
        >
          <Redo2 size={15} />
        </button>

        <div className="topbar-divider" />

        <button className="export-btn" onClick={onExport}>
          <FileVideo size={14} />
          Export
        </button>

        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
};
