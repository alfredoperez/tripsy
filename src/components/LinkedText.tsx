// Notes come from Claude and people typing, so booking links arrive as plain
// text ("Book: https://donjulio.meitre.com"). This turns them into short,
// tappable links that open in a new tab.

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
const TRAILING = /[.,;:!?)\]]+$/;

type Part = { text: string; href?: string };

export function splitLinks(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const href = raw.replace(TRAILING, "");
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: linkLabel(href), href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** "donjulio.meitre.com", "mishiguene.com/reservas.php", "enigmatickets.com/…". */
export function linkLabel(href: string) {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/$/, "");
    if (!path) return host;
    return path.length <= 16 ? `${host}${path}` : `${host}/…`;
  } catch {
    return href;
  }
}

/** For one-line previews inside a button, where a real link can't go. */
export function withoutLinks(text: string) {
  return splitLinks(text)
    .map((part) => part.text)
    .join("");
}

export function LinkedText({ text, linkClassName = "" }: { text: string; linkClassName?: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className={`font-medium underline decoration-1 underline-offset-2 [overflow-wrap:anywhere] ${linkClassName}`}
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
