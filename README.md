# GIS Elevation Profile

Aplicacao Vue + TypeScript para analise de perfis de elevacao e visualizacao espacial de dados geograficos.

## Funcionalidades

- Geracao de perfil de elevacao a partir de quatro colunas: distancia, coordenadas e elevacao.
- Conversao automatica de coordenadas em graus ou UTM para visualizacao no mapa.
- Exibicao da linha do perfil em mapa Leaflet.
- Importacao de arquivos KML/KMZ com pontos e linhas.
- Projecao opcional dos pontos importados sobre o grafico de perfil.
- Leitura de metadados EXIF/XMP/IPTC de imagens georreferenciadas.
- Agrupamento de imagens por ponto e exportacao dos pontos para KMZ.

## Estrutura

Descricao de pastas e responsabilidades: [docs/estrutura-do-projeto.md](docs/estrutura-do-projeto.md)

```text
src/
	components/
		ElevationChart.vue
		ElevationInput.vue
		ImageMetadataMap.vue
		KmzMap.vue
	types/
		profile.ts
	utils/
		profileMarkers.ts
	App.vue
	main.ts
	style.css
```

## Fluxo principal

### Perfil de elevacao

1. O usuario cola os dados no componente de entrada.
2. O app interpreta as colunas e gera pontos do perfil.
3. O grafico renderiza a serie de elevacao.
4. O mapa desenha a linha do perfil com base nas coordenadas calculadas.

### Pontos KML/KMZ no perfil

1. O usuario importa um arquivo KML ou KMZ no mapa.
2. Os pontos importados sao enviados ao componente principal.
3. Cada ponto e associado ao ponto mais proximo da linha do perfil.
4. O grafico pode exibir ou ocultar esses marcadores com um controle proprio.

### Imagens e metadados

1. O usuario seleciona uma pasta com imagens.
2. Os metadados sao lidos com EXIF/XMP/IPTC.
3. As imagens sao agrupadas por codigo do ponto.
4. Os pontos sao mostrados no mapa e podem ser exportados para KMZ.

## Scripts

- `npm run dev`: inicia o ambiente de desenvolvimento.
- `npm run build`: executa a checagem TypeScript e gera o build de producao.
- `npm run preview`: serve o build gerado localmente.

## Dependencias principais

- `vue`: interface e reatividade.
- `leaflet`: mapa interativo.
- `proj4`: conversao de coordenadas.
- `jszip`: leitura e geracao de KMZ.
- `exifr`: leitura de metadados de imagens.
