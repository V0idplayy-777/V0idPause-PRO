import React, { useState } from 'react';
import { X, Settings, Monitor } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { fps, setFps, resolution, setProjectName, name } = useStore();
  const [localFps, setLocalFps] = useState(fps);
  const [localW, setLocalW] = useState(resolution.width);
  const [localH, setLocalH] = useState(resolution.height);
  const [localName, setLocalName] = useState(name);

  const handleSave = () => {
    setFps(localFps);
    setProjectName(localName);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><Settings size={16} /> Project Settings</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h4 className="settings-section-title"><Monitor size={13} /> Sequence</h4>
            <div className="settings-row">
              <label>Project Name</label>
              <input className="settings-input" value={localName} onChange={e => setLocalName(e.target.value)} />
            </div>
            <div className="settings-row">
              <label>Frame Rate</label>
              <select className="settings-input" value={localFps} onChange={e => setLocalFps(Number(e.target.value))}>
                {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map(r => (
                  <option key={r} value={r}>{r} fps</option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <label>Resolution</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="settings-input" type="number" value={localW} onChange={e => setLocalW(Number(e.target.value))} style={{ width: 80 }} />
                <span style={{ color: '#666' }}>x</span>
                <input className="settings-input" type="number" value={localH} onChange={e => setLocalH(Number(e.target.value))} style={{ width: 80 }} />
              </div>
            </div>
            <div className="settings-presets">
              {[
                { label: '4K UHD', w: 3840, h: 2160 },
                { label: '1080p', w: 1920, h: 1080 },
                { label: '720p', w: 1280, h: 720 },
                { label: '9:16 (Short)', w: 1080, h: 1920 },
                { label: 'Square', w: 1080, h: 1080 },
              ].map(p => (
                <button key={p.label} className="export-preset-btn" onClick={() => { setLocalW(p.w); setLocalH(p.h); }}>{p.label}</button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
};
