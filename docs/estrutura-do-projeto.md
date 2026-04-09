# Estrutura do projeto

Este arquivo descreve a organizacao das pastas em nivel alto.
O objetivo e facilitar leitura e apresentacao do codigo sem depender de uma lista detalhada de arquivos, que envelhece mais rapido.

## Raiz

- `src/`: codigo-fonte da aplicacao.
- `public/`: arquivos estaticos servidos pelo Vite sem passar pelo bundle.
- `dist/`: build gerado para producao.
- `package.json`: scripts e dependencias do projeto.
- `vite.config.ts`: configuracao do Vite.
- `tsconfig*.json`: configuracoes do TypeScript.

## src

- `App.vue`: composicao principal da interface e orquestracao entre as telas.
- `main.ts`: ponto de entrada da aplicacao Vue.
- `style.css`: estilos globais da aplicacao.
- `components/`: componentes visuais e funcionais.
- `types/`: tipos compartilhados entre componentes e utilitarios.
- `utils/`: funcoes auxiliares sem responsabilidade de interface.

## src/components

- `ElevationInput.vue`: entrada e interpretacao dos dados do perfil de elevacao.
- `ElevationChart.vue`: renderizacao do grafico de elevacao e seus marcadores.
- `KmzMap.vue`: importacao de KML/KMZ e visualizacao dos dados no mapa.
- `ImageMetadataMap.vue`: leitura de metadados de imagens, agrupamento por ponto e exportacao KMZ.

## src/types

- `profile.ts`: tipos compartilhados ligados ao perfil, coordenadas e pontos importados.

## src/utils

- `profileMarkers.ts`: projecao de pontos importados sobre a linha do perfil.

## Regra pratica para manter este arquivo util

Se a pasta continuar existindo com a mesma responsabilidade, o texto nao precisa mudar.
Atualize este arquivo apenas quando a responsabilidade de uma pasta ou modulo mudar de verdade.