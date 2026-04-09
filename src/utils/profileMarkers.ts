import type {
  ImportedKmzPoint,
  KmzMarkerOnProfile,
  LatLng,
  ProfilePoint,
} from '../types/profile'

export function projectKmzPointsOntoProfile(
  kmzPoints: ImportedKmzPoint[],
  profilePoints: ProfilePoint[],
  profileCoordinates: LatLng[],
): KmzMarkerOnProfile[] {
  if (!kmzPoints.length || !profilePoints.length || !profileCoordinates.length) {
    return []
  }

  return kmzPoints
    .map((point) => {
      let bestIndex = -1
      let bestDistanceSquared = Number.POSITIVE_INFINITY

      for (let index = 0; index < profileCoordinates.length; index++) {
        const coordinate = profileCoordinates[index]!
        const deltaLat = coordinate.lat - point.lat
        const deltaLng = coordinate.lng - point.lng
        const distanceSquared = deltaLat * deltaLat + deltaLng * deltaLng

        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared
          bestIndex = index
        }
      }

      if (bestIndex === -1 || !profilePoints[bestIndex]) {
        return null
      }

      return {
        ...point,
        distanceMeters: profilePoints[bestIndex]!.distanceMeters,
      }
    })
    .filter((marker): marker is KmzMarkerOnProfile => marker !== null)
}