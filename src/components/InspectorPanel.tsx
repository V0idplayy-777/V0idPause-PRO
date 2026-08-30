import React, { useState } from 'react';
import {
  Sliders, Volume2,
  ChevronDown, ChevronRight, RefreshCw, Film,
  Palette, Clock, Layers, CornerDownRight, Type
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { FilterSettings, TransitionType } from '../types';

const TRANSITIONS: TransitionType[] = ['none', 'fade', 'slide', 'wipe', 'dissolve'];
const FONTS = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onReset?: () => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step = 1, unit = '', onChange, onReset }) => (
  <div className="inspector-row">
    <label className="inspector-label">{label}</label>
    <div className="inspector-control">
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="inspector-slider"
      />
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="inspector-number"
      />
      {unit && <span className="inspector-unit">{unit}</span>}
      {onReset && (
        <button className="icon-btn-sm" onClick={() => onReset()} title="Reset">
          <RefreshCw size={9} />
        </button>
      )}
    </div>
  </div>
);

interface SectionProps { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; }
const Section: React.FC<SectionProps> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="inspector-section">
      <button className="inspector-section-header" onClick={() => setOpen(v => !v)}>
        <span className="inspector-section-icon">{icon}</span>
        <span className="inspector-section-title">{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="inspector-section-body">{children}</div>}
    </div>
  );
};

export const InspectorPanel: React.FC = () => {
  const { selectedClipIds, clips, updateClip } = useStore();
  const clipId = selectedClipIds[0];
  const clip = clips.find(c => c.id === clipId);

  if (!clip) {
    return (
      <div className="panel inspector-panel">
        <div className="panel-header"><span className="panel-title">Inspector</span></div>
        <div className="inspector-empty">
          <Sliders size={24} className="inspector-empty-icon" />
          <p>Select a clip to inspect</p>
        </div>
      </div>
    );
  }

  const u = (updates: Parameters<typeof updateClip>[1]) => updateClip(clip.id, updates);
  const f = clip.filters || { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0 };
  const uf = (patch: Partial<FilterSettings>) => u({ filters: { ...f, ...patch } });

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">
        <span className="panel-title">Inspector</span>
        <span className="inspector-clip-name" title={clip.name}>{clip.name}</span>
      </div>

      <div className="inspector-body">

        <Section title="Motion" icon={<Layers size={13} />}>
  <SliderRow label="Opacity" value={(clip.opacity ?? 1) * 100} min={0} max={100} unit="%" onChange={v => u({ opacity: v / 100 })} onReset={() => u({ opacity: 1 })} />
  <SliderRow label="Scale" value={(clip.scale ?? 1) * 100} min={10} max={300} unit="%" onChange={v => u({ scale: v / 100 })} onReset={() => u({ scale: 1 })} />
  <SliderRow label="Position X" value={clip.x ?? 0} min={-1000} max={1000} unit="px" onChange={v => u({ x: v })} onReset={() => u({ x: 0 })} />
  <SliderRow label="Position Y" value={clip.y ?? 0} min={-1000} max={1000} unit="px" onChange={v => u({ y: v })} onReset={() => u({ y: 0 })} />
  <SliderRow label="Speed" value={clip.speed ?? 1} min={0.25} max={4} step={0.05} unit="x" onChange={v => u({ speed: v })} onReset={() => u({ speed: 1 })} />
</Section>

        <Section title="Timing" icon={<Clock size={13} />}>
          <div className="inspector-row">
            <label className="inspector-label">Start</label>
            <input
              type="number"
              value={Math.round(clip.startTime * 100) / 100}
              min={0} step={0.1}
              onChange={e => u({ startTime: Math.max(0, Number(e.target.value)) })}
              className="inspector-number full"
            />
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Duration</label>
            <input
              type="number"
              value={Math.round(clip.duration * 100) / 100}
              min={0.1} step={0.1}
              onChange={e => u({ duration: Math.max(0.1, Number(e.target.value)) })}
              className="inspector-number full"
            />
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Trim In</label>
            <input
              type="number"
              value={Math.round((clip.trimStart || 0) * 100) / 100}
              min={0} step={0.1}
              onChange={e => u({ trimStart: Math.max(0, Number(e.target.value)) })}
              className="inspector-number full"
            />
          </div>
        </Section>

        {(clip.type === 'video' || clip.type === 'audio') && (
          <Section title="Audio" icon={<Volume2 size={13} />}>
            <SliderRow label="Volume" value={(clip.volume ?? 1) * 100} min={0} max={200} unit="%" onChange={v => u({ volume: v / 100 })} onReset={() => u({ volume: 1 })} />
            <div className="inspector-row">
              <label className="inspector-label">Mute</label>
              <input type="checkbox" checked={!!clip.muted} onChange={e => u({ muted: e.target.checked })} className="inspector-checkbox" />
            </div>
          </Section>
        )}

        {(clip.type === 'video' || clip.type === 'image') && (
          <Section title="Color & Effects" icon={<Palette size={13} />} defaultOpen={false}>
            <SliderRow label="Brightness" value={f.brightness} min={0} max={200} unit="%" onChange={v => uf({ brightness: v })} onReset={() => uf({ brightness: 100 })} />
            <SliderRow label="Contrast" value={f.contrast} min={0} max={200} unit="%" onChange={v => uf({ contrast: v })} onReset={() => uf({ contrast: 100 })} />
            <SliderRow label="Saturation" value={f.saturation} min={0} max={200} unit="%" onChange={v => uf({ saturation: v })} onReset={() => uf({ saturation: 100 })} />
            <SliderRow label="Hue" value={f.hue} min={-180} max={180} unit="deg" onChange={v => uf({ hue: v })} onReset={() => uf({ hue: 0 })} />
            <SliderRow label="Blur" value={f.blur} min={0} max={20} step={0.5} unit="px" onChange={v => uf({ blur: v })} onReset={() => uf({ blur: 0 })} />
            <SliderRow label="Sepia" value={f.sepia} min={0} max={100} unit="%" onChange={v => uf({ sepia: v })} onReset={() => uf({ sepia: 0 })} />
            <SliderRow label="Grayscale" value={f.grayscale} min={0} max={100} unit="%" onChange={v => uf({ grayscale: v })} onReset={() => uf({ grayscale: 0 })} />
            <button className="reset-all-btn" onClick={() => uf({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0 })}>
              <RefreshCw size={11} /> Reset All Filters
            </button>
          </Section>
        )}

<Section title="Transitions" icon={<CornerDownRight size={13} />} defaultOpen={false}>
  <div className="inspector-row">
    <label className="inspector-label">Type</label>
    <select
      className="inspector-select"
      value={clip.transition || 'none'}
      onChange={e => u({ transition: e.target.value as TransitionType })}
    >
      {TRANSITIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
    </select>
  </div>
  <SliderRow
    label="Duration"
    value={clip.transitionDuration ?? 0.5}
    min={0}
    max={3}
    step={0.05}
    unit="s"
    onChange={v => u({ transitionDuration: v })}
    onReset={() => u({ transitionDuration: 0.5 })}
  />
</Section>

        {clip.type === 'text' && (
          <Section title="Text" icon={<Type size={13} />}>
            <div className="inspector-row">
              <label className="inspector-label">Content</label>
              <textarea
                className="inspector-textarea"
                value={clip.textContent || ''}
                onChange={e => u({ textContent: e.target.value })}
                rows={3}
              />
            </div>
            <SliderRow label="Size" value={clip.fontSize || 64} min={8} max={256} unit="px" onChange={v => u({ fontSize: v })} />
            <div className="inspector-row">
              <label className="inspector-label">Font</label>
              <select className="inspector-select" value={clip.fontFamily || 'Inter'} onChange={e => u({ fontFamily: e.target.value })}>
                {FONTS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
              </select>
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Color</label>
              <input type="color" value={clip.textColor || '#ffffff'} onChange={e => u({ textColor: e.target.value })} className="inspector-color" />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Background</label>
              <input type="color" value={clip.textBgColor === 'transparent' || !clip.textBgColor ? '#000000' : clip.textBgColor} onChange={e => u({ textBgColor: e.target.value })} className="inspector-color" />
              <button className="inspector-clear-btn" onClick={() => u({ textBgColor: 'transparent' })}>Clear</button>
            </div>
          </Section>
        )}

        <Section title="Clip Info" icon={<Film size={13} />} defaultOpen={false}>
          <div className="inspector-info-row"><span>Type</span><span className="capitalize">{clip.type}</span></div>
          <div className="inspector-info-row"><span>Name</span><span>{clip.name}</span></div>
          <div className="inspector-info-row"><span>Duration</span><span>{clip.duration.toFixed(2)}s</span></div>
          <div className="inspector-info-row"><span>Start</span><span>{clip.startTime.toFixed(2)}s</span></div>
          <div className="inspector-info-row"><span>End</span><span>{(clip.startTime + clip.duration).toFixed(2)}s</span></div>
        </Section>

      </div>
    </div>
  );
};
