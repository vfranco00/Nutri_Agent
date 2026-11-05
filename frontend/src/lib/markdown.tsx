import { Fragment, type ReactNode } from "react";

const LINK_OK = /^(https?:\/\/|mailto:|\/)/;

function inline(texto: string, chave: string): ReactNode[] {
  // **negrito** e [texto](url); todo o resto é texto puro (React escapa).
  const partes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  let i = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1] !== undefined) {
      partes.push(<strong key={`${chave}-${i++}`}>{m[1]}</strong>);
    } else if (LINK_OK.test(m[3])) {
      partes.push(
        <a key={`${chave}-${i++}`} href={m[3]} className="font-semibold text-act-text underline">
          {m[2]}
        </a>,
      );
    } else {
      partes.push(m[2]);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Conversor de Markdown leve (títulos, listas, citações, negrito, links). Não usa HTML cru. */
export function Markdown({ source }: { source: string }) {
  const blocos = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocos.map((bloco, bi) => {
        const linhas = bloco.split("\n").filter((l) => l.trim() !== "");
        if (linhas.length === 0) return null;
        const h = /^(#{1,3})\s+(.*)$/.exec(linhas[0]);
        if (h && linhas.length === 1) {
          const nivel = h[1].length;
          const cls = nivel === 1 ? "mt-2 mb-3 text-2xl font-extrabold" : "mt-6 mb-2 text-lg font-extrabold";
          const Tag = (`h${nivel}`) as "h1" | "h2" | "h3";
          return <Tag key={bi} className={cls}>{inline(h[2], `h${bi}`)}</Tag>;
        }
        if (linhas.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="my-2 list-disc space-y-1 pl-5">
              {linhas.map((l, li) => <li key={li}>{inline(l.replace(/^[-*]\s+/, ""), `l${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        if (linhas.every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={bi} className="my-3 rounded-2xl bg-soft p-3 text-sm text-mut">
              {inline(linhas.map((l) => l.replace(/^>\s?/, "")).join(" "), `q${bi}`)}
            </blockquote>
          );
        }
        return (
          <p key={bi} className="my-2 leading-relaxed">
            {linhas.map((l, li) => <Fragment key={li}>{li > 0 ? " " : null}{inline(l, `p${bi}-${li}`)}</Fragment>)}
          </p>
        );
      })}
    </>
  );
}
