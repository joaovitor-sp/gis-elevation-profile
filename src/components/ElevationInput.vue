<script setup lang="ts">
import { ref } from 'vue'
import proj4 from 'proj4'

type LatLng = {
  lat: number
  lng: number
}

// Ajuste aqui para a zona/hemisfério UTM do seu projeto
// Exemplo: SIRGAS 2000 / UTM zone 23S (sul do Brasil)
const UTM_PROJECTION = '+proj=utm +zone=23 +south +datum=WGS84 +units=m +no_defs'

const model = ref<string>('')
const errors = ref<string[]>([])

const emit = defineEmits<{
  (e: 'update:elevations', values: number[]): void
  (e: 'update:coordinates', coordinates: LatLng[]): void
}>()

function parseElevations(
  raw: string,
): { values: number[]; coordinates: LatLng[]; errors: string[] } {
  const lines = raw.split(/\r?\n/)
  const values: number[] = []
  const parseErrors: string[] = []
  const coordinates: LatLng[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      // Ignora linhas vazias caso ocorram
      return
    }

    // Se houver mais de uma coluna, pega sempre a última como elevação
    // Separadores comuns: tab, espaços, ponto-e-vírgula
    const parts = trimmed.split(/[\t;\s]+/).filter(Boolean)

    if (!parts.length) {
      parseErrors.push(`Linha ${index + 1}: nenhum valor encontrado.`)
      return
    }

    const lastToken = parts[parts.length - 1] ?? ''

    if (!lastToken) {
      parseErrors.push(`Linha ${index + 1}: nenhum valor numérico encontrado.`)
      return
    }

    const normalized = lastToken.replace(',', '.')
    const value = Number(normalized)

    if (!Number.isFinite(value)) {
      parseErrors.push(`Linha ${index + 1}: valor inválido "${line}"`)
      return
    }

    values.push(value)

    // Opcional: coordenadas nas colunas antes da elevação.
    // Suporta:
    //  - lat, lon, elevação (graus)
    //  - lon, lat, elevação (graus)
    //  - E, N, elevação (UTM em metros)
    //  - distância, E, N, elevação (UTM em metros)
    if (parts.length >= 3) {
      const coordTokens = parts.slice(0, parts.length - 1)
      const nums = coordTokens.map((t) => Number(t.replace(',', '.')))

      if (nums.some((n) => !Number.isFinite(n))) {
        return
      }

      let lat: number | null = null
      let lng: number | null = null

      // Primeiro tenta como graus (usa as duas primeiras colunas numéricas)
      if (nums.length >= 2) {
        const a = nums[0]!
        const b = nums[1]!

        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
          lat = a
          lng = b
        } else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
          lat = b
          lng = a
        }
      }

      // Se não for graus, tenta como UTM (usa SEMPRE as duas últimas colunas antes da elevação).
      if (lat === null && lng === null && nums.length >= 2) {
        const e = nums[nums.length - 2]!
        const n = nums[nums.length - 1]!

        if (e > 1000 && n > 1000) {
          try {
            const [lonProj, latProj] = proj4(UTM_PROJECTION, 'WGS84', [e, n])
            lat = latProj
            lng = lonProj
          } catch {
            // se der erro na projeção, ignora as coordenadas desta linha
          }
        }
      }

      if (
        lat !== null &&
        lng !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        coordinates.push({ lat, lng })
      }
    }
  })

  if (!values.length) {
    parseErrors.push('Nenhum valor numérico de elevação foi encontrado.')
  }

  // Se não tivermos coordenadas para todas as elevações, ignoramos para não desenhar um perfil incompleto
  const finalCoordinates =
    coordinates.length === values.length ? coordinates : []

  return { values, coordinates: finalCoordinates, errors: parseErrors }
}

function handleGenerate() {
  const { values, coordinates, errors: parseErrors } = parseElevations(model.value)
  errors.value = parseErrors

  if (!parseErrors.length) {
    emit('update:elevations', values)
    if (coordinates.length) {
      emit('update:coordinates', coordinates)
    } else {
      emit('update:coordinates', [])
    }
  }
}
</script>

<template>
  <section class="elevation-input">
    <header class="elevation-input__header">
      <h1>Perfil de Elevação</h1>
      <p>
        Cole aqui a coluna de valores de elevação copiada do QGIS (Topodata)
        ou do Excel. Cada linha pode conter apenas um valor numérico ou três
        colunas: <strong>latitude</strong>, <strong>longitude</strong> e
        <strong>elevação</strong> (em graus), ou então
        <strong>E (UTM)</strong>, <strong>N (UTM)</strong> e
        <strong>elevação</strong> (em metros).
      </p>
    </header>

    <div class="elevation-input__body">
      <label class="elevation-input__label" for="elevation-textarea">
        Valores de elevação (uma por linha)
      </label>
      <textarea
        id="elevation-textarea"
        v-model="model"
        class="elevation-input__textarea"
        rows="12"
        placeholder="Exemplo:\n123.45\n124.10\n125.80\n..."
      />

      <button type="button" class="elevation-input__button" @click="handleGenerate">
        Gerar gráfico de elevação
      </button>

      <p class="elevation-input__hint">
        Dica: selecione a coluna de elevação no QGIS ou Excel, copie (Ctrl+C)
        e cole (Ctrl+V) diretamente na área de texto acima.
      </p>

      <ul v-if="errors.length" class="elevation-input__errors">
        <li v-for="(error, index) in errors" :key="index">
          {{ error }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.elevation-input {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.elevation-input__header h1 {
  margin: 0 0 0.5rem;
  font-size: 1.8rem;
}

.elevation-input__header p {
  margin: 0;
  color: #555;
}

.elevation-input__body {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.elevation-input__label {
  font-weight: 600;
}

.elevation-input__textarea {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #d0d7de;
  background-color: #0f172a;
  color: #e5e7eb;
  resize: vertical;
}

.elevation-input__textarea:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.elevation-input__button {
  align-self: flex-start;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(90deg, #2563eb, #22c55e);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.4);
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
}

.elevation-input__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.6);
  filter: brightness(1.05);
}

.elevation-input__button:active {
  transform: translateY(0);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.5);
}

.elevation-input__hint {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.elevation-input__errors {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: #f97373;
  font-size: 0.9rem;
}
</style>
