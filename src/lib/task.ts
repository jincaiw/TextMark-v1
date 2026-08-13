export function setTaskChecked(source: string, lineNumber: number, checked: boolean): string | null {
  const lines = source.split(/\r?\n/);
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) return null;
  const task = /^(\s*(?:>\s*)?(?:[-+*]|\d+[.)])\s+)\[([ xX])\]/.exec(lines[index]);
  if (!task) return null;
  lines[index] = lines[index].replace(task[0], `${task[1]}[${checked ? "x" : " "}]`);
  return lines.join("\n");
}
