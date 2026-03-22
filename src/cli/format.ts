// ANSI terminal formatting — zero external deps

const enabled = process.stdout.isTTY === true && !process.env.NO_COLOR;

function wrap(code: string, text: string): string {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const bold  = (t: string) => wrap('1', t);
export const dim   = (t: string) => wrap('2', t);
export const green = (t: string) => wrap('32', t);
export const yellow = (t: string) => wrap('33', t);
export const red   = (t: string) => wrap('31', t);
export const cyan  = (t: string) => wrap('36', t);

/** Print a table with padded columns. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
  );

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const sep = widths.map(w => '-'.repeat(w)).join('  ');

  const lines: string[] = [];
  lines.push(headers.map((h, i) => bold(pad(h, widths[i]))).join('  '));
  lines.push(dim(sep));
  for (const row of rows) {
    lines.push(row.map((c, i) => pad(c ?? '', widths[i])).join('  '));
  }
  return lines.join('\n');
}

/** Print the GitStore banner. */
export function banner(): string {
  return `\n${bold(cyan('GitStore'))} ${dim('— App store for GitHub')}\n`;
}
