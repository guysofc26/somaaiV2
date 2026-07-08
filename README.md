# SomaAI v2

Evolução do SomaAI original, focada em duas frentes: **confiabilidade do OCR** e
**histórico de itens editável**. A identidade visual (tema escuro, verde `#22c55e`,
mira central 256×192) foi mantida.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` no celular (na mesma rede) ou faça deploy (ex.: Vercel) —
a câmera exige HTTPS ou `localhost` para funcionar.

## O que mudou desde a v1

### 1. OCR mais confiável (`lib/ocr.ts`)

- **Upscale do recorte**: a região da mira é reamostrada para ~900px de largura antes
  do reconhecimento. Texto pequeno de etiquetas ganha muito com isso — o Tesseract lê
  melhor caracteres com altura de 30-40px.
- **Duas variantes de pré-processamento**: contraste (igual à v1) e **binarização de
  Otsu** (preto/branco puro, calculado automaticamente a partir do histograma da
  imagem). A segunda entra em cena só se a primeira não achar um preço válido.
- **`tessedit_pageseg_mode`**: agora fixado em `SINGLE_LINE` nas duas primeiras
  tentativas (a etiqueta dentro da mira é uma linha só), o que reduz ruído comparado
  ao modo padrão do Tesseract.
- **Retry automático com mira expandida**: se as duas primeiras tentativas falharem,
  uma terceira tentativa usa uma área 1.6× maior com modo `SPARSE_TEXT` — cobre o caso
  do usuário não ter centralizado perfeitamente a etiqueta.
- **`parsePrice` mais robusto**: agora reconhece separador de milhar (`1.234,56`) e,
  em vez de aceitar cegamente o primeiro número encontrado, testa todos os candidatos
  até achar um valor plausível.
- **Fallback de entrada manual**: se as 3 tentativas falharem, um modal pede para o
  usuário digitar o preço — evita ficar preso escaneando a mesma etiqueta.

### 2. Histórico de itens (`components/HistoryDrawer.tsx`, `lib/storage.ts`)

- Cada item escaneado (ou digitado manualmente) fica guardado com preço, horário e
  uma miniatura da região capturada, pra você conferir se o OCR leu certo.
- Painel deslizante (toque em "Total Estimado" pra abrir) lista todos os itens,
  permite **editar** o valor (ex.: corrigir um OCR errado) ou **remover** um item —
  o total é recalculado automaticamente.
- O histórico é salvo em `localStorage`, então fechar o app/aba no meio da compra
  não perde os itens já escaneados.

### 3. Estrutura de arquivos

O componente único de ~250 linhas virou:

```
app/page.tsx              # orquestração de estado (câmera, itens, modais)
components/
  CameraView.tsx           # vídeo + overlay + mira
  BottomPanel.tsx          # total, último item, botões
  HistoryDrawer.tsx         # lista de itens (editar/remover)
  ManualEntryModal.tsx      # fallback de digitação manual
lib/
  ocr.ts                    # pipeline de reconhecimento (recorte, pré-proc., parse)
  storage.ts                # persistência do histórico em localStorage
  types.ts                  # tipos compartilhados
```

## Limitações conhecidas / próximos passos

- A binarização de Otsu roda no thread principal (JS puro); em fotos muito grandes
  pode custar alguns milissegundos a mais — se notar travamento em aparelhos mais
  fracos, dá pra mover o pré-processamento pra um Web Worker separado.
- Não há categorização de produtos nem OCR do nome do item, só do preço — é o
  próximo passo natural se quiser ir além de "somar valores".
- O ícone SVG é um placeholder simples; vale trocar por uma identidade visual
  definitiva antes de publicar nas lojas.
