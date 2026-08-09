import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";
import { t } from "../lib/i18n";
import type { Locale, SearchMode } from "../types";

interface FindBarProps {
  query: string; current: number; count: number; matchCase: boolean; mode: SearchMode; locale: Locale;
  onQueryChange: (value: string) => void; onPrevious: () => void; onNext: () => void;
  onMatchCaseChange: (value: boolean) => void; onModeChange: (mode: SearchMode) => void; onClose: () => void;
}

export function FindBar(props: FindBarProps) {
  return <div className="find-bar" role="search">
    <input autoFocus value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder={t(props.locale, "find")} onKeyDown={(event) => { if (event.key === "Enter") event.shiftKey ? props.onPrevious() : props.onNext(); if (event.key === "Escape") props.onClose(); }} />
    <select aria-label={t(props.locale, "find")} value={props.mode} onChange={(event) => props.onModeChange(event.target.value as SearchMode)}><option value="contains">{t(props.locale, "contains")}</option><option value="beginsWith">{t(props.locale, "beginsWith")}</option></select>
    <span>{props.query ? t(props.locale, "matchCount", { current: props.count ? props.current + 1 : 0, count: props.count }) : ""}</span>
    <button className={props.matchCase ? "selected" : ""} title={t(props.locale, "matchCase")} onClick={() => props.onMatchCaseChange(!props.matchCase)}><CaseSensitive /></button>
    <button title={t(props.locale, "previousMatch")} disabled={!props.count} onClick={props.onPrevious}><ChevronUp /></button>
    <button title={t(props.locale, "nextMatch")} disabled={!props.count} onClick={props.onNext}><ChevronDown /></button>
    <button title={t(props.locale, "done")} onClick={props.onClose}><X /></button>
  </div>;
}
