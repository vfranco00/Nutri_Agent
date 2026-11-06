import "./codigo-de-barras.css";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScanBarcode, X } from "lucide-react";
import { api } from "../../lib/api";
import { ROUTES } from "../../routes";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { FoodOption } from "../../types";

const CODIGO_VALIDO = /^\d{8,14}$/;

type Camera = "iniciando" | "ativa" | "indisponivel" | "negada";
type Resultado =
  | { tipo: "livre" }
  | { tipo: "buscando" }
  | { tipo: "nao_achou"; code: string }
  | { tipo: "indisponivel"; code: string }
  | { tipo: "erro"; code: string };

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/** Liga a câmera e chama `onCodigo` com o primeiro código lido. Devolve a função que desliga. */
async function iniciarLeitura(
  video: HTMLVideoElement,
  onCodigo: (code: string) => void,
): Promise<() => void> {
  const Nativo = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Nativo) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    const detector = new Nativo({ formats: FORMATOS });
    const timer = setInterval(() => {
      detector
        .detect(video)
        .then((r) => {
          if (r[0]?.rawValue) onCodigo(r[0].rawValue);
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
    };
  }
  // Sem BarcodeDetector (Safari, Firefox): zxing, carregado só quando precisa.
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  const leitor = new BrowserMultiFormatReader(hints);
  const controles = await leitor.decodeFromConstraints(
    { video: { facingMode: "environment" } },
    video,
    (res) => {
      if (res) onCodigo(res.getText());
    },
  );
  return () => controles.stop();
}

export function CodigoDeBarras() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const location = useLocation();
  const [camera, setCamera] = useState<Camera>("iniciando");
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<Resultado>({ tipo: "livre" });
  const ocupado = useRef(false);

  const consultar = useCallback(
    async (code: string) => {
      if (!CODIGO_VALIDO.test(code) || ocupado.current) return;
      ocupado.current = true;
      setResultado({ tipo: "buscando" });
      try {
        const { data } = await api.get<FoodOption>(`/diary/foods/barcode/${code}`);
        navigate(ROUTES.alimento(data.food_ref), {
          replace: true,
          state: { ...((location.state as object | null) ?? {}), porcao: data },
        });
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response?.status;
        if (status === 404) setResultado({ tipo: "nao_achou", code });
        else if (status === 503) setResultado({ tipo: "indisponivel", code });
        else setResultado({ tipo: "erro", code });
      } finally {
        ocupado.current = false;
      }
    },
    [navigate, location.state],
  );

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("indisponivel");
      return;
    }
    let parar: (() => void) | undefined;
    let cancelado = false;
    iniciarLeitura(videoRef.current!, (code) => void consultar(code))
      .then((p) => {
        if (cancelado) p();
        else {
          parar = p;
          setCamera("ativa");
        }
      })
      .catch((e: { name?: string }) => {
        if (cancelado) return;
        setCamera(e?.name === "NotAllowedError" || e?.name === "NotFoundError" ? "negada" : "indisponivel");
      });
    return () => {
      cancelado = true;
      parar?.();
    };
  }, [consultar]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    void consultar(texto.trim());
  }

  const valido = CODIGO_VALIDO.test(texto.trim());
  const semCamera = camera === "negada" || camera === "indisponivel";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#141210] text-[#FFF6EC]">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 active:scale-[.97]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-base font-extrabold">Código de barras</h1>
        <span className="w-10" aria-hidden="true" />
      </header>

      <div className="mx-auto mt-4 w-full max-w-md px-11">
        <div className="relative h-[150px] overflow-hidden rounded-[22px] border-[3px] border-[#E8590C]">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${semCamera ? "hidden" : ""}`}
          />
          {semCamera ? (
            <div className="flex h-full items-center justify-center">
              <ScanBarcode className="h-10 w-10 text-[#a39a90]" aria-hidden="true" />
            </div>
          ) : (
            <div className="barcode-line absolute inset-x-3 top-2.5 h-[3px] rounded-sm bg-[#E8590C]" />
          )}
        </div>
        <p className="mt-3 text-center text-[13px] text-[#a39a90]" aria-live="polite">
          {camera === "negada"
            ? "A câmera não está liberada. Digite o código da embalagem."
            : camera === "indisponivel"
              ? "Não deu para abrir a câmera. Digite o código da embalagem."
              : "aponte para o código da embalagem"}
        </p>
      </div>

      <form onSubmit={enviar} className="mx-auto mt-6 w-full max-w-md px-6">
        <label htmlFor="codigo-manual" className="mb-1.5 block text-[13px] font-bold">
          Digite o código
        </label>
        <div className="flex gap-2">
          <Input
            id="codigo-manual"
            inputMode="numeric"
            autoComplete="off"
            placeholder="7891097000123"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 14))}
            className="bg-[#1f1b17] text-[#FFF6EC] border-white/20"
          />
          <Button type="submit" disabled={!valido || resultado.tipo === "buscando"}>
            Buscar
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-[#a39a90]">De 8 a 14 números, como está embaixo das barras.</p>
      </form>

      <div className="mx-auto mt-4 w-full max-w-md px-6 pb-10" aria-live="polite">
        {resultado.tipo === "buscando" && <p className="text-sm text-[#a39a90]">Procurando…</p>}
        {resultado.tipo === "nao_achou" && (
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-sm font-bold">Não achamos esse código.</p>
            <Link
              to={`${ROUTES.alimentoNovo}?barcode=${resultado.code}`}
              className="mt-3 inline-flex rounded-2xl bg-[#E8590C] px-4 py-3 text-sm font-extrabold text-[#1C1712]"
            >
              Cadastrar como meu alimento
            </Link>
          </div>
        )}
        {resultado.tipo === "indisponivel" && (
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-sm font-bold">Não deu para consultar agora</p>
            <Button className="mt-3" onClick={() => void consultar(resultado.code)}>
              Tentar de novo
            </Button>
          </div>
        )}
        {resultado.tipo === "erro" && (
          <p className="text-sm font-bold">Algo deu errado. Tente de novo em instantes.</p>
        )}
      </div>
    </div>
  );
}
