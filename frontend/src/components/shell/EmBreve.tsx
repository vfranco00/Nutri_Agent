/** Marcador das telas novas que as outras frentes ainda vão construir. */
export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="py-16 text-center">
      <h2 className="text-2xl font-black tracking-tight text-ink">{titulo}</h2>
      <p className="mt-2 text-sm text-mut">Em breve.</p>
    </div>
  );
}
