import React from "react"
import ReactDOM from "react-dom/client"
import { App as CapacitorApp } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"
import App from "./App"
import "./styles.css"

void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
void StatusBar.setBackgroundColor({ color: "#eef8ef" }).catch(() => undefined)

CapacitorApp.addListener("backButton", ({ canGoBack }) => {
  if (canGoBack) {
    window.history.back()
  } else {
    void CapacitorApp.minimizeApp()
  }
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
