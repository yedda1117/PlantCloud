import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.plantcloud.mobile",
  appName: "PlantCloud",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: {
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#eef8ef",
    },
  },
}

export default config
