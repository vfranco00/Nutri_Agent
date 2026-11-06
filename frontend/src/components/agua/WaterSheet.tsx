import { useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const RAPIDAS = [150, 200, 300, 500];

export function WaterSheet({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (ml: number) => void;
}) {
  const [livre, setLivre] = useState("");
  const ml = Number(livre);
  const valido = Number.isInteger(ml) && ml >= 1 && ml <= 5000;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Outra quantidade">
      <div className="grid grid-cols-2 gap-2">
        {RAPIDAS.map((v) => (
          <Button key={v} variant="outline" onClick={() => onAdd(v)}>
            {v} ml
          </Button>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onAdd(ml);
        }}
      >
        <Input
          aria-label="Quantidade em ml"
          inputMode="numeric"
          placeholder="Outro valor, em ml"
          value={livre}
          onChange={(e) => setLivre(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <Button type="submit" disabled={!valido}>
          Adicionar
        </Button>
      </form>
    </Sheet>
  );
}
