import { useEffect, useRef, useState, useCallback } from 'react'
import type { Topic } from '../types'
import { PLATFORM_COLORS } from '../hooks'

interface Props {
  topics: Topic[]
  onSelectTopic: (t: Topic) => void
}

function extractKeywords(name: string): string[] {
  const stop = new Set(['this','that','with','from','have','been','were','they','them','about','into','over','also','then','than','just','like','some','other','only','more','very','will','what','when','which','would','could','there','their','should','because','through','between'])
  return [...new Set(name.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length>=4&&!stop.has(w)).slice(0,5))]
}

const PLATFORM_HEX: Record<string, string> = {
  'hermes': '#7c3aed',
  'claude-code': '#00a572', 
  'chatgpt-web': '#0062d2',
  'claude-web': '#00a572',
}

export function MeshGraph({ topics, onSelectTopic }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const init = useCallback(async () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || topics.length === 0) return

    const THREE = await import('three')
    const w = container.clientWidth
    const h = 500

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 200)
    camera.position.set(0, 8, 55)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    // Lighting
    scene.add(new THREE.AmbientLight(0x556688, 2.5))
    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(15, 25, 20)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8866cc, 1.2)
    fill.position.set(-10, -10, -10)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x4488ff, 1)
    rim.position.set(0, -15, 0)
    scene.add(rim)

    // Starfield
    const stars = new THREE.BufferGeometry()
    const sp = new Float32Array(600 * 3)
    for (let i = 0; i < sp.length; i += 3) {
      sp[i] = (Math.random()-0.5)*180; sp[i+1] = (Math.random()-0.5)*180; sp[i+2] = (Math.random()-0.5)*180
    }
    stars.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x334466, size: 0.25 })))

    // Build nodes
    const limit = Math.min(topics.length, 80)
    const sliced = topics.slice(0, limit)
    const kwMap = sliced.map(t => extractKeywords(t.name))

    // Find min/max message count for sizing
    const maxMsgs = Math.max(...sliced.map(t => t.message_count_exported), 1)
    const minMsgs = Math.min(...sliced.map(t => t.message_count_exported), 1)

    const nodes: any[] = []
    const nodeData: any[] = []
    const labelDivs: HTMLDivElement[] = []

    // Fibonacci sphere layout
    const phi = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < sliced.length; i++) {
      const t = sliced[i]
      const y = 1 - (i / (sliced.length - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = phi * i
      const r = 22 + Math.random() * 6

      const x = Math.cos(theta) * radius * r
      const z = Math.sin(theta) * radius * r
      const yPos = y * r

      // Size: map message count to 0.8 - 5.0
      const size = 0.8 + ((t.message_count_exported - minMsgs) / Math.max(maxMsgs - minMsgs, 1)) * 4.2
      const pc = PLATFORM_COLORS[t.platforms?.[0] || '']
      const colorHex = PLATFORM_HEX[t.platforms?.[0] || ''] || pc?.dot || '#958da1'

      // Sphere
      const geom = new THREE.SphereGeometry(size, 48, 48)
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.25,
        metalness: 0.15,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: 0.35,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(x, yPos, z)
      mesh.userData = { topic: t, size, color: colorHex, baseX: x, baseY: yPos, baseZ: z }
      scene.add(mesh)
      nodes.push(mesh)

      // CSS label
      const label = document.createElement('div')
      label.className = 'absolute pointer-events-none transition-opacity'
      label.style.cssText = `
        font-family: 'Hanken Grotesk', sans-serif;
        font-size: 10px;
        font-weight: 600;
        color: ${colorHex};
        text-shadow: 0 0 6px rgba(0,0,0,0.8);
        white-space: nowrap;
        transform: translate(-50%, -50%);
      `
      label.textContent = t.name.slice(0, 18) + (t.name.length > 18 ? '…' : '')
      container.appendChild(label)
      labelDivs.push(label)
      nodeData.push({ mesh, label, topic: t })
    }

    // Edges
    for (let i = 0; i < sliced.length; i++) {
      for (let j = i + 1; j < sliced.length; j++) {
        const a = new Set(kwMap[i]), b = new Set(kwMap[j])
        if (a.size === 0 || b.size === 0) continue
        const int = [...a].filter(x => b.has(x)).length
        const weight = int / (a.size + b.size - int)
        if (weight >= 0.25) {
          const from = nodes[i].position, to = nodes[j].position
          const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
          mid.add(new THREE.Vector3((Math.random()-0.5)*6, (Math.random()-0.5)*6, (Math.random()-0.5)*6))
          const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone())
          const pts = curve.getPoints(16)
          const geom = new THREE.BufferGeometry().setFromPoints(pts)
          scene.add(new THREE.Line(geom, new THREE.LineBasicMaterial({
            color: new THREE.Color(nodes[i].userData.color),
            transparent: true, opacity: 0.1 + weight * 0.15,
          })))
        }
      }
    }

    // Mouse state
    let isDragging = false, prevX = 0, prevY = 0
    let targetRotH = 0.5, targetRotV = 0.3, rotH = 0.5, rotV = 0.3
    let targetZoom = 55, zoom = 55
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY })
    canvas.addEventListener('mousemove', e => {
      if (isDragging) {
        targetRotH += (e.clientX - prevX) * 0.004
        targetRotV += (e.clientY - prevY) * 0.004
        targetRotV = Math.max(-1.4, Math.min(1.4, targetRotV))
        prevX = e.clientX; prevY = e.clientY
      }
      // Hover detection
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(nodes)
      if (hits.length > 0) {
        const topic = hits[0].object.userData?.topic
        if (topic) {
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top - 20,
            text: `${topic.name.slice(0, 40)}\n${topic.message_count_exported} 則訊息 · ${topic.session_count} 個回合`,
          })
        }
      } else {
        setTooltip(null)
      }
    })
    canvas.addEventListener('mouseup', e => {
      if (isDragging && Math.abs(e.clientX - prevX) < 3 && Math.abs(e.clientY - prevY) < 3) {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(nodes)
        if (hits.length > 0) {
          const topic = hits[0].object.userData?.topic
          if (topic) onSelectTopic(topic)
        }
      }
      isDragging = false
    })
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      targetZoom = Math.max(12, Math.min(100, targetZoom + e.deltaY * 0.05))
    }, { passive: false })

    const onResize = () => {
      const w2 = container.clientWidth
      camera.aspect = w2 / 500; camera.updateProjectionMatrix()
      renderer.setSize(w2, 500)
    }
    window.addEventListener('resize', onResize)

    // Animate
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)

      rotH += (targetRotH - rotH) * 0.06
      rotV += (targetRotV - rotV) * 0.06
      zoom += (targetZoom - zoom) * 0.06

      const camX = zoom * Math.cos(rotV) * Math.sin(rotH)
      const camY = zoom * Math.sin(rotV)
      const camZ = zoom * Math.cos(rotV) * Math.cos(rotH)
      camera.position.set(camX, camY, camZ)
      camera.lookAt(0, 0, 0)

      // Update CSS labels
      const rect = canvas.getBoundingClientRect()
      for (const nd of nodeData) {
        const pos = nd.mesh.position.clone().project(camera)
        const x = (pos.x * 0.5 + 0.5) * rect.width
        const y = (-pos.y * 0.5 + 0.5) * rect.height
        nd.label.style.left = x + 'px'
        nd.label.style.top = y + 'px'
        // Fade labels behind camera
        nd.label.style.opacity = pos.z < 1 ? '0.8' : '0'
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      for (const nd of nodeData) nd.label.remove()
      renderer.dispose()
    }
  }, [topics, onSelectTopic])

  useEffect(() => {
    let cleanupFn: (() => void) | undefined
    init().then(fn => { cleanupFn = fn })
    return () => { cleanupFn?.() }
  }, [init])

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden cursor-grab active:cursor-grabbing" style={{ height: '500px', backgroundColor: 'var(--bg-deep)' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      {tooltip && (
        <div className="absolute pointer-events-none px-3 py-2 rounded-lg border text-xs leading-relaxed whitespace-pre"
          style={{
            left: tooltip.x, top: tooltip.y,
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text)',
            fontFamily: "'Hanken Grotesk', sans-serif",
            boxShadow: 'var(--shadow-card)',
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
          }}>
          {tooltip.text}
        </div>
      )}
      {topics.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p style={{ color: 'var(--text-muted)' }}>沒有可視覺化的主題</p>
        </div>
      )}
    </div>
  )
}
