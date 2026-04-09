export type LatLng = {
  lat: number
  lng: number
}

export type ProfilePoint = {
  distanceMeters: number
  latitudeMeters: number
  longitudeMeters: number
  elevationMeters: number
}

export type ImportedKmzPoint = {
  id: number
  name: string
  lat: number
  lng: number
}

export type KmzTablePoint = ImportedKmzPoint & {
  litologia: string
  unidadeGeologica: string
  mergulho: string
}

export type KmzMarkerOnProfile = ImportedKmzPoint & {
  distanceMeters: number
}