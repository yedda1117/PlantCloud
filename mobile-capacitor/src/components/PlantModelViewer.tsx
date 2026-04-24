import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

type PlantModelViewerProps = {
  modelPath: string
  className?: string
}

export function PlantModelViewer({ modelPath, className }: PlantModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let frameId = 0

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xe7f2eb, 6, 14)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 0.45, 4.8)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)

    const hemiLight = new THREE.HemisphereLight(0xf9fffb, 0xdce7df, 1.9)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(4, 5, 4)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xdff3e8, 1)
    fillLight.position.set(-3, 2, 2.5)
    scene.add(fillLight)

    const rimLight = new THREE.PointLight(0xfff1d1, 0.85, 16)
    rimLight.position.set(0, -0.6, -3.6)
    scene.add(rimLight)

    const shadowGround = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.ShadowMaterial({ opacity: 0.14, color: 0x5e7d6b }),
    )
    shadowGround.rotation.x = -Math.PI / 2
    shadowGround.position.y = -1.2
    shadowGround.receiveShadow = true
    scene.add(shadowGround)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.minPolarAngle = Math.PI / 3.2
    controls.maxPolarAngle = Math.PI / 1.9

    let root: any = null

    const resize = () => {
      const width = mount.clientWidth || 320
      const height = mount.clientHeight || 320
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    }

    const frameModel = (object: any) => {
      const box = new THREE.Box3().setFromObject(object)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z, 0.8)
      const fitDistance = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360))
      const distance = fitDistance * 1.48

      object.position.sub(center)
      object.position.y += size.y * 0.08

      camera.position.set(maxDim * 0.14, maxDim * 0.42, distance)
      camera.near = Math.max(distance / 100, 0.1)
      camera.far = distance * 20
      camera.updateProjectionMatrix()

      controls.target.set(0, size.y * 0.18, 0)
      controls.minDistance = Math.max(distance * 0.66, 1.8)
      controls.maxDistance = distance * 2.1
      controls.update()
    }

    const loader = new GLTFLoader()
    setState("loading")
    loader.load(
      modelPath,
      (gltf: any) => {
        if (disposed) return

        root = gltf.scene
        root.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => {
                material.needsUpdate = true
              })
            } else if (child.material) {
              child.material.needsUpdate = true
            }
          }
        })

        scene.add(root)
        frameModel(root)
        resize()
        setState("ready")
      },
      undefined,
      () => {
        if (!disposed) setState("error")
      },
    )

    const animate = () => {
      if (disposed) return
      controls.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(animate)
    }

    resize()
    animate()
    window.addEventListener("resize", resize)

    return () => {
      disposed = true
      window.removeEventListener("resize", resize)
      window.cancelAnimationFrame(frameId)
      controls.dispose()

      if (root) {
        root.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose?.()
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => material.dispose?.())
            } else {
              child.material?.dispose?.()
            }
          }
        })
      }

      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [modelPath])

  return (
    <div className={`model-viewer-shell ${className ?? ""}`}>
      <div className="model-viewer-canvas" ref={mountRef} />
      {state !== "ready" ? (
        <div className="model-viewer-overlay">
          <span>{state === "loading" ? "Loading 3D model..." : "Model unavailable"}</span>
        </div>
      ) : null}
    </div>
  )
}
