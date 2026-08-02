import { Bold, Code, Italic, Link, List, ListChecks, ListOrdered, Quote, Strikethrough } from "lucide-react";
import type { FormatCommand } from "../types";

interface FormattingToolbarProps { onFormat: (command: FormatCommand) => void; }

export function FormattingToolbar({ onFormat }: FormattingToolbarProps) {
  return (
    <div className="formatting-toolbar" role="toolbar" aria-label="Markdown formatting">
      <select aria-label="Text style" defaultValue="h0" onChange={(event) => { onFormat(event.target.value as FormatCommand); event.currentTarget.value = "h0"; }}>
        <option value="h0">Body</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
      </select>
      <span />
      <button title="Bold" onClick={() => onFormat("bold")}><Bold /></button>
      <button title="Italic" onClick={() => onFormat("italic")}><Italic /></button>
      <button title="Strikethrough" onClick={() => onFormat("strikethrough")}><Strikethrough /></button>
      <span />
      <button title="Bulleted list" onClick={() => onFormat("bulletList")}><List /></button>
      <button title="Numbered list" onClick={() => onFormat("orderedList")}><ListOrdered /></button>
      <button title="Checklist" onClick={() => onFormat("taskList")}><ListChecks /></button>
      <button title="Quote" onClick={() => onFormat("quote")}><Quote /></button>
      <span />
      <button title="Inline code" onClick={() => onFormat("code")}><Code /></button>
      <button title="Link" onClick={() => onFormat("link")}><Link /></button>
    </div>
  );
}
