import { Fragment, type ReactNode } from "react";

const LINK_OK = /^(https?:\/\/|mailto:|\/)/;

function inline(texto: string, chave: string): ReactNode[] {
  // **negrito** e [texto](url); todo o resto é texto puro (React escapa).
  const partes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  let i = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1] !== undefined) {
      partes.push(<strong key={`${chave}-${i++}`}>{inline(m[1], `${chave}-b${i}`)}</strong>);
    } else if (m[2] !== undefined) {
      partes.push(<code key={`${chave}-${i++}`} className="rounded bg-soft px-1 text-[0.9em]">{m[2]}</code>);
    } else if (LINK_OK.test(m[4])) {
      partes.push(
        <a key={`${chave}-${i++}`} href={m[4]} className="font-semibold text-act-text underline">
          {m[3]}
        </a>,
      );
    } else {
      partes.push(m[3]);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Conversor de Markdown leve (títulos, listas, citações, negrito, links). Não usa HTML cru. */
export function Markdown({ source }: { source: string }) {
  const blocos = source.replace(/\r\n/g, "\n").replace(/^(#{1,3} .*)$/gm, "\n$1\n").split(/\n{2,}/);
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
        if (linhas.every((l) => /^\d+\.\s+/.test(l))) {
          return (
            <ol key={bi} className="my-2 list-decimal space-y-1 pl-5">
              {linhas.map((l, li) => <li key={li}>{inline(l.replace(/^\d+\.\s+/, ""), `o${bi}-${li}`)}</li>)}
            </ol>
          );
        }
        if (linhas.length >= 2 && linhas.every((l) => l.trim().startsWith("|"))) {
          const celulas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          const [cab, , ...corpo] = linhas;
          return (
            <div key={bi} className="my-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr>{celulas(cab).map((c, ci) => <th key={ci} className="border-b border-line p-2 font-bold">{inline(c, `th${bi}-${ci}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {corpo.map((l, li) => (
                    <tr key={li} className="align-top">
                      {celulas(l).map((c, ci) => <td key={ci} className="border-b border-line p-2">{inline(c, `td${bi}-${li}-${ci}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
