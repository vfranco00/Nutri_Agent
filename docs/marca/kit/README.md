# Kit da marca Nuvi

Marca aprovada em 05/11/2026: o nome **Nuvi** e o símbolo da **fatia de laranja**, com casca, parte branca e oito gomos separados, todos da mesma cor. Para ver a marca aplicada no app, abra a página [`../nuvi-fatia.html`](../nuvi-fatia.html).

## Arquivos

### `svg/` (vetor, para o site, o app e o design)

| Arquivo | Para quê |
|---|---|
| `simbolo.svg` | Símbolo sobre fundo claro (creme ou branco). |
| `simbolo-fundo-escuro.svg` | Símbolo sobre o fundo escuro `#1A120B`. |
| `simbolo-fundo-laranja.svg` | Símbolo em creme, sobre o fundo laranja `#E8590C`. |
| `logo-horizontal.svg` | Símbolo e "nuvi" sobre fundo claro. |
| `logo-horizontal-fundo-escuro.svg` | Símbolo e "nuvi" sobre o fundo escuro. |
| `logo-horizontal-fundo-laranja.svg` | Símbolo e "nuvi" em creme, sobre laranja. |
| `icone-app.svg` | Ícone do app: fatia sobre creme, com margem. |
| `icone-maskable.svg` | Ícone para Android, com o símbolo dentro da zona segura de 80%. |
| `favicon.svg` | Favicon com cantos arredondados. |

O "nuvi" nos `logo-horizontal*.svg` é **texto** em Nunito Black, carregado do Google Fonts. Ele aparece certo no navegador. Em programas de design (Figma, Illustrator), instale a Nunito e converta o texto em contorno antes de exportar para impressão ou para a loja de apps. Os PNGs abaixo já saem com a fonte certa.

### `png/` (imagem pronta)

| Arquivo | Tamanho | Para quê |
|---|---|---|
| `icon-192.png`, `icon-512.png` | 192 e 512 | Ícones do PWA (`purpose: "any"`). |
| `maskable-192.png`, `maskable-512.png` | 192 e 512 | Ícones do PWA (`purpose: "maskable"`). |
| `apple-touch-icon.png` | 180 | Ícone na tela de início do iPhone. |
| `favicon-32.png`, `favicon-16.png` | 32 e 16 | Favicon para navegadores antigos. |
| `simbolo-512.png` | 512 | Símbolo com fundo transparente. |
| `logo-horizontal*.png` | 1104 × 400 | Logo com fundo transparente, nas três versões. |
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
5. **Tamanho mínimo**: o símbolo lê bem até 16 px; abaixo de 24 px de altura, use só o símbolo, sem o "nuvi".
6. **Não** gire, estique, troque as cores dos gomos nem coloque o símbolo laranja sobre fundo laranja (use a versão `-fundo-laranja`).

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
- Converter o "nuvi" em contorno (vetor puro) para impressão.
- O app hoje usa a fonte DM Sans. O logotipo fica em Nunito, que é desenho de marca, e não precisa mudar.
