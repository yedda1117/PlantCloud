export type PlantOption = {
  id: string
  name: string
  emoji: string
  apiId: number
}

export const DEFAULT_PLANT_ID = "p1"
export const SELECTED_PLANT_STORAGE_KEY = "plantcloud_selected_plant"

export const plantOptions: PlantOption[] = [
  { id: "p1", name: "薄荷", emoji: "🌿", apiId: 1 },
  { id: "p2", name: "多肉", emoji: "🪴", apiId: 2 },
  { id: "p3", name: "绿萝", emoji: "🍃", apiId: 3 },
  { id: "p4", name: "虎皮兰", emoji: "🌱", apiId: 4 },
  { id: "p5", name: "绣球", emoji: "🌸", apiId: 5 },
  { id: "p6", name: "向日葵", emoji: "🌻", apiId: 6 },
]

export function getPlantOption(plantId: string) {
  return plantOptions.find((plant) => plant.id === plantId) ?? plantOptions[0]
}

export function getPlantApiId(plantId: string) {
  return getPlantOption(plantId).apiId
}
