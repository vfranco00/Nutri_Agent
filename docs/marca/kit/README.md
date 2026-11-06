# Kit da marca Nuvi

Marca aprovada em 05/11/2026: o nome **Nuvi** e o símbolo da **fatia de laranja**, com casca, parte branca e oito gomos separados, todos da mesma cor. Em 06/11/2026 foi aprovado o **logotipo com a fatia no pingo do i** ("nuv" + "ı" sem pingo, e a fatia no lugar do pingo); o símbolo sozinho segue como ícone do app. Para ver a marca aplicada no app, abra a página [`../nuvi-fatia.html`](../nuvi-fatia.html).

## Arquivos

### `svg/` (vetor, para o site, o app e o design)

| Arquivo | Para quê |
|---|---|
| `simbolo.svg` | Símbolo sobre fundo claro (creme ou branco). |
| `simbolo-fundo-escuro.svg` | Símbolo sobre o fundo escuro `#1A120B`. |
| `simbolo-fundo-laranja.svg` | Símbolo em creme, sobre o fundo laranja `#E8590C`. |
| `logo-horizontal.svg` | Logotipo "nuvi" com a fatia no pingo do i, sobre fundo claro. |
| `logo-horizontal-fundo-escuro.svg` | O mesmo logotipo sobre o fundo escuro. |
| `logo-horizontal-fundo-laranja.svg` | O mesmo logotipo em creme, sobre laranja. |
| `icone-app.svg` | Ícone do app: fatia sobre creme, com margem. |
| `icone-maskable.svg` | Ícone para Android, com o símbolo dentro da zona segura de 80%. |
| `favicon.svg` | Favicon com cantos arredondados. |

O "nuvi" nos `logo-horizontal*.svg` já está **convertido em contorno** (Nunito Black, extraída com `fontTools`), então o arquivo não depende da fonte e serve para impressão e para a loja de apps. Os nomes nos arquivos mantêm `logo-horizontal` por compatibilidade, mas o logotipo agora é uma palavra só, sem o símbolo ao lado.

#### Logotipo com a fatia no pingo do i (versão B)

- Texto "nuv" + "ı" (U+0131, i sem pingo) em Nunito 900, espaçamento −0,04em entre letras (0 no "ı") e altura de linha 1.
- A fatia mede **0,42em × 0,42em**, centralizada na haste do "ı", com a base **0,8em acima** da base da caixa de linha do "ı" (cerca de 0,63em acima da linha de base da letra).
- Desenho: casca r=41, parte branca r=35 e 8 gomos `wedge(50,50,6,31,a+5,a+40)`, com `a = i*45-90`. Abaixo de ~40 px de altura, use a versão simplificada: `wedge(50,50,7,33,a+7,a+38)`.
- Cores: fundo claro com casca `#E8590C`, branco `#FFF6EC` e gomo `#FF9A52`; fundo escuro `#1A120B` com casca `#FF6A26`, branco igual ao fundo e gomo `#FFB07A`; fundo laranja tudo em creme `#FFF6EC`, com a parte branca em `#E8590C`.
- No app, o componente é `NuviLogo` (`frontend/src/components/brand/NuviLogo.tsx`).

### `png/` (imagem pronta)

| Arquivo | Tamanho | Para quê |
|---|---|---|
| `icon-192.png`, `icon-512.png` | 192 e 512 | Ícones do PWA (`purpose: "any"`). |
| `maskable-192.png`, `maskable-512.png` | 192 e 512 | Ícones do PWA (`purpose: "maskable"`). |
| `apple-touch-icon.png` | 180 | Ícone na tela de início do iPhone. |
| `favicon-32.png`, `favicon-16.png` | 32 e 16 | Favicon para navegadores antigos. |
| `simbolo-512.png` | 512 | Símbolo com fundo transparente. |
| `logo-horizontal*.png` | 1104 × 400 | Logotipo com fundo transparente, nas três versões. |
| `og-image-1200x630.png` | 1200 × 630 | Prévia do link no WhatsApp, Instagram e redes sociais. |

### Cores

- `cores.css`: variáveis CSS (`--nuvi-laranja`, `--nuvi-creme`…).
- `cores.json`: as mesmas cores, com o uso de cada uma e o contraste.

| Cor | Hex | Uso |
|---|---|---|
| Laranja | `#E8590C` | Marca, botões de ação, medidor |
| Laranja como texto | `#C2410C` | Palavra em laranja sobre fundo claro |
| Gomo | `#FF9A52` | Só no desenho do símbolo |
| Verde | `#3FA34D` | Positivo: meta batida, "no plano" |
| Verde como texto | `#2F7A33` | Texto positivo sobre fundo claro |
| Creme | `#FFF6EC` | Fundo do tema claro e do ícone |
| Tinta | `#1C1712` | Texto principal e texto no botão laranja |
| Secundário | `#7A6A58` | Texto secundário |
| Escuro | `#1A120B` | Fundo do tema escuro |

## Regras de uso

1. **Botão laranja com texto escuro** (`#1C1712`). Texto branco sobre o laranja fica abaixo do contraste mínimo.
2. **Cor sólida** em botões, medidores e no símbolo. Sem gradiente.
3. **"nuvi" sempre em minúsculas**, em Nunito Black (peso 900), com espaçamento entre letras de −0,04em.
4. **Espaço livre** em volta do logo: pelo menos a largura de um gomo de cada lado.
5. **Tamanho mínimo**: o símbolo lê bem até 16 px. O logotipo com o pingo precisa de pelo menos 18 px de altura de letra; abaixo disso, use só o símbolo. Abaixo de ~40 px, use a fatia simplificada.
6. **O símbolo não vai mais ao lado do nome**: a fatia só aparece como pingo do i ou sozinha (ícone, favicon).
7. **Não** gire, estique, troque as cores dos gomos nem coloque o símbolo laranja sobre fundo laranja (use a versão `-fundo-laranja`).

## Para o PWA (`manifest.webmanifest`)

```json
{
  "name": "Nuvi",
  "short_name": "Nuvi",
  "description": "Seu agente de nutrição",
  "theme_color": "#E8590C",
  "background_color": "#FFF6EC",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

No `<head>` do `index.html`:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#E8590C">
<meta property="og:image" content="/og-image-1200x630.png">
```

Os arquivos ainda **não** foram copiados para `frontend/public/`. Isso fica para a implementação do redesign.

## Pendências

- Consultar o nome **Nuvi** no INPI (classes 9 e 42) e os domínios `nuvi.app` e `nuvi.com.br`. Há um app de treinos chamado NUVI Lifestyles, um app chamado Nouvi e a antiga linha de GPS nüvi da Garmin.
- O app hoje usa a fonte DM Sans. O logotipo fica em Nunito, que é desenho de marca, e não precisa mudar.
