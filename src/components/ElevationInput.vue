<script setup lang="ts">
import { ref } from 'vue'

type ProfilePoint = {
  distanceMeters: number
  latitudeMeters: number
  longitudeMeters: number
  elevationMeters: number
}

const model = ref<string>('')
const errors = ref<string[]>([])

const emit = defineEmits<{
  (e: 'update:elevations', values: ProfilePoint[]): void
}>()

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'))
}

function parseElevations(raw: string): { values: ProfilePoint[]; errors: string[] } {
  const lines = raw.split(/\r?\n/)
  const values: ProfilePoint[] = []
  const parseErrors: string[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      // Ignora linhas vazias caso ocorram
      return
    }

    // Separadores comuns: tab, espaços, ponto-e-vírgula.
    const parts = trimmed.split(/[\t;\s]+/).filter(Boolean)

    if (parts.length < 4) {
      parseErrors.push(
        `Linha ${index + 1}: esperado 4 colunas (posição, latitude, longitude, elevação).`,
      )
      return
    }

    const distanceMeters = parseNumber(parts[0] ?? '')
    const latitudeMeters = parseNumber(parts[1] ?? '')
    const longitudeMeters = parseNumber(parts[2] ?? '')
    const elevationMeters = parseNumber(parts[3] ?? '')

    if (
      Number.isFinite(distanceMeters) &&
      Number.isFinite(latitudeMeters) &&
      Number.isFinite(longitudeMeters) &&
      Number.isFinite(elevationMeters)
    ) {
      values.push({
        distanceMeters,
        latitudeMeters,
        longitudeMeters,
        elevationMeters,
      })
    } else {
      parseErrors.push(`Linha ${index + 1}: valor inválido "${line}"`)
    }
  })

  if (!values.length) {
    parseErrors.push('Nenhum ponto válido foi encontrado nas 4 colunas esperadas.')
  }

  return { values, errors: parseErrors }
}

function handleGenerate() {
  const { values, errors: parseErrors } = parseElevations(model.value)
  errors.value = parseErrors

  if (!parseErrors.length) {
    emit('update:elevations', values)
  }
}
</script>

<template>
  <section class="elevation-input">
    <header class="elevation-input__header">
      <h1>Perfil de Elevação</h1>
      <p>
        Cole aqui os dados em 4 colunas na ordem: posição (m), latitude,
        longitude e elevação (m).
      </p>
    </header>

    <div class="elevation-input__body">
      <label class="elevation-input__label" for="elevation-textarea">
        Dados de perfil (4 colunas por linha)
      </label>
      <textarea
        id="elevation-textarea"
        v-model="model"
        class="elevation-input__textarea"
        rows="12"
        placeholder="Exemplo:\n0.0 375231.7634 9357547.3236 201.476\n2.8243 375234.0856 9357548.9313 201.476\n39.7112 375264.3721 9357569.9875 200.712"
      />

      <button type="button" class="elevation-input__button" @click="handleGenerate">
        Gerar gráfico de elevação
      </button>

      <p class="elevation-input__hint">
        Dica: exporte os pontos no QGIS/Excel com as 4 colunas na ordem
        indicada, copie (Ctrl+C) e cole (Ctrl+V) diretamente na área de texto.
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
