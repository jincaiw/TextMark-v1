import { BookOpen, Code2, Minus, Plus } from "lucide-react";

interface StatusBarProps {
  line: number;
  column: number;
  words: number;
  zoom: number;
  notice: string | null;
  busy: boolean;
  onZoomChange: (zoom: number) => void;
}

export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-ready"><span className={props.busy ? "busy" : ""} />{props.notice ?? (props.busy ? "Working…" : "Ready")}</div>
      <div className="status-details">
        <span>Ln {props.line}, Col {props.column}</span>
        <span>UTF-8</span>
        <span>{props.words.toLocaleString()} words</span>
        <BookOpen size={14} />
        <Code2 size={14} />
        <div className="zoom-control">
          <button onClick={() => props.onZoomChange(Math.max(70, props.zoom - 10))} aria-label="Zoom out"><Minus size={13} /></button>
          <span>{props.zoom}%</span>
          <input aria-label="Preview zoom" type="range" min="70" max="160" step="10" value={props.zoom} onChange={(event) => props.onZoomChange(Number(event.target.value))} />
          <button onClick={() => props.onZoomChange(Math.min(160, props.zoom + 10))} aria-label="Zoom in"><Plus size={13} /></button>
        </div>
      </div>
    </footer>
  );
}
