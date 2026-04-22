"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

type PlantModelViewerProps = {
  modelPath: string
  className?: string
}

export function PlantModelViewer({ modelPath, className }: PlantModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorText, setErrorText] = useState("模型加载失败，请检查文件路径或模型内容。")

  useEffect(() => {
    const mountNode = mountRef.current
    if (!mountNode) {
      return
    }

    let frameId = 0
    let disposed = false
    let controls: OrbitControls | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let rootObject: THREE.Object3D | null = null

    const width = mountNode.clientWidth || 640
    const height = mountNode.clientHeight || 640

    scene = new THREE.Scene()
    scene.background = null
    scene.fog = new THREE.Fog(0xf7fbf7, 7, 14)

    camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100)
    camera.position.set(0, 0.3, 4.8)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountNode.appendChild(renderer.domElement)

    const ambientLight = new THREE.HemisphereLight(0xf6fff7, 0xe6ece7, 1.75)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(3.5, 5, 4)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xdff7ec, 1.05)
    fillLight.position.set(-4, 2.5, 3)
    scene.add(fillLight)

    const rimLight = new THREE.PointLight(0xfff1d6, 0.9, 18)
    rimLight.position.set(0, -1.2, -4)
    scene.add(rimLight)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.ShadowMaterial({ color: 0x6b8f7b, opacity: 0.12 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.35
    ground.receiveShadow = true
    scene.add(ground)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 2.1
    controls.maxDistance = 7.5
    controls.minPolarAngle = Math.PI / 3.2
    controls.maxPolarAngle = Math.PI / 1.9
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.target.set(0, 0.2, 0)
    controls.update()

    const frameModel = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z, 0.8)
      const fitHeightDistance = maxDim / (2 * Math.tan((Math.PI * camera!.fov) / 360))
      const distance = fitHeightDistance * 1.45

      object.position.sub(center)
      object.position.y += size.y * 0.08

      camera!.position.set(maxDim * 0.15, maxDim * 0.42, distance)
      camera!.near = Math.max(distance / 100, 0.1)
      camera!.far = distance * 20
      camera!.updateProjectionMatrix()

      controls!.target.set(0, size.y * 0.2, 0)
      controls!.minDistance = Math.max(distance * 0.65, 1.8)
      controls!.maxDistance = distance * 2.1
      controls!.update()
    }

    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        if (disposed || !scene) {
          return
        }

        rootObject = gltf.scene
        rootObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.needsUpdate = true)
            } else if (child.material) {
              child.material.needsUpdate = true
            }
          }
        })

        scene.add(rootObject)
        frameModel(rootObject)
        setStatus("ready")
      },
      undefined,
      () => {
        if (disposed) {
          return
        }
        setStatus("error")
        setErrorText("3D 模型未找到，请确认文件位于 public/models/zhizihua.glb。")
      },
    )

    const handleResize = () => {
      if (!mountNode || !camera || !renderer) {
        return
      }
      const nextWidth = mountNode.clientWidth || 640
      const nextHeight = mountNode.clientHeight || 640
      camera.aspect = nextWidth / nextHeight
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, nextHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    const animate = () => {
      if (!renderer || !scene || !camera || disposed) {
        return
      }
      controls?.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(animate)
    }

    window.addEventListener("resize", handleResize)
    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleResize)
      controls?.dispose()

      if (rootObject) {
        rootObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
      }

      scene?.clear()
      if (renderer) {
        renderer.dispose()
        renderer.forceContextLoss()
        if (renderer.domElement.parentNode === mountNode) {
          mountNode.removeChild(renderer.domElement)
        }
      }
    }
  }, [modelPath])

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[2rem] ${className ?? ""}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.88),_rgba(240,252,244,0.76)_42%,_rgba(232,245,238,0.92)_100%)]" />
      <div className="pointer-events-none absolute inset-x-[14%] top-[8%] h-24 rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-[18%] bottom-[8%] h-16 rounded-full bg-emerald-100/60 blur-2xl" />

      <div ref={mountRef} className="relative z-10 h-full w-full" />

      {status !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-2xl border border-white/60 bg-white/72 px-5 py-4 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <p className="text-sm font-medium text-zinc-800">
              {status === "loading" ? "正在载入植物 3D 模型..." : errorText}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {status === "loading" ? "支持鼠标拖拽旋转与滚轮缩放" : "模型就绪后会在这里显示可交互预览"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
