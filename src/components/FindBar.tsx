import { CaseSensitive, ChevronDown, ChevronUp, WholeWord, X } from "lucide-react";

interface FindBarProps {
  query: string;
  current: number;
  count: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  onQueryChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onWholeWordChange: (value: boolean) => void;
  onClose: () => void;
}

export function FindBar(props: FindBarProps) {
  return (
    <div className="find-bar" role="search">
      <input autoFocus value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Find" onKeyDown={(event) => { if (event.key === "Enter") event.shiftKey ? props.onPrevious() : props.onNext(); if (event.key === "Escape") props.onClose(); }} />
      <span>{props.query ? `${props.count ? props.current + 1 : 0} of ${props.count}` : ""}</span>
      <button className={props.caseSensitive ? "selected" : ""} title="Match Case" onClick={() => props.onCaseSensitiveChange(!props.caseSensitive)}><CaseSensitive /></button>
      <button className={props.wholeWord ? "selected" : ""} title="Whole Words" onClick={() => props.onWholeWordChange(!props.wholeWord)}><WholeWord /></button>
      <button title="Previous Match" disabled={!props.count} onClick={props.onPrevious}><ChevronUp /></button>
      <button title="Next Match" disabled={!props.count} onClick={props.onNext}><ChevronDown /></button>
      <button title="Done" onClick={props.onClose}><X /></button>
    </div>
  );
}
