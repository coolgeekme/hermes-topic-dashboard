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

export function MeshGraph({ topics, onSelectTopic }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [hoveredLabel, setHoveredLabel] = useState('')

  const init = useCallback(async () => {
    const canvas = canvasRef.current
    const labels = labelsRef.current
    if (!canvas || !labels || topics.length === 0) return

    const THREE = await import('three')
    const w = canvas.clientWidth
    const h = canvas.clientHeight || 500

    // Scene
    const scene = new THREE.Scene()
    
    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 200)
    camera.position.set(0, 5, 60)
    camera.lookAt(0, 0, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 3))
    const key = new THREE.DirectionalLight(0xffffff, 2)
    key.position.set(10, 20, 20)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8866cc, 1)
    fill.position.set(-10, -5, -10)
    scene.add(fill)

    // Starfield background
    const stars = new THREE.BufferGeometry()
    const starPos = new Float32Array(800 * 3)
    for (let i = 0; i < starPos.length; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 200
      starPos[i+1] = (Math.random() - 0.5) * 200
      starPos[i+2] = (Math.random() - 0.5) * 200
    }
    stars.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x334466, size: 0.3 })))

    // Build nodes
    const limit = Math.min(topics.length, 60)
    const sliced = topics.slice(0, limit)
    const kwMap = sliced.map(t => extractKeywords(t.name))

    const nodes: any[] = []
    const nodeMap = new Map<string, any>()

    // Fibonacci sphere distribution
    const phi = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < sliced.length; i++) {
      const t = sliced[i]
      const y = 1 - (i / (sliced.length - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = phi * i
      const r = 22 + Math.random() * 8

      const x = Math.cos(theta) * radius * r
      const z = Math.sin(theta) * radius * r
      const yPos = y * r

      const size = Math.max(0.8, Math.min(4, Math.log(t.message_count_exported + 1) * 0.9))
      const pc = PLATFORM_COLORS[t.platforms?.[0] || '']
      const color = pc?.dot || '#7c3aed'

      // Sphere with glow
      const geom = new THREE.SphereGeometry(size, 48, 48)
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.3,
        metalness: 0.1,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.4,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(x, yPos, z)
      mesh.userData = { topic: t, size, color, baseX: x, baseY: yPos, baseZ: z }

      // Outer glow ring
      const ringGeom = new THREE.RingGeometry(size * 1.3, size * 1.5, 32)
      const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: true, opacity: 0.15 })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.position.copy(mesh.position)
      ring.lookAt(camera.position)
      ring.userData = { parent: mesh }
      scene.add(ring)

      scene.add(mesh)
      nodes.push({ mesh, ring })
      nodeMap.set(t.id, mesh)
    }

    // Edges
    const edgeGroup = new THREE.Group()
    for (let i = 0; i < sliced.length; i++) {
      for (let j = i + 1; j < sliced.length; j++) {
        const a = new Set(kwMap[i])
        const b = new Set(kwMap[j])
        if (a.size === 0 || b.size === 0) continue
        const int = [...a].filter(x => b.has(x)).length
        const union = a.size + b.size - int
        const weight = int / union
        if (weight >= 0.25) {
          const from = nodes[i].mesh.position
          const to = nodes[j].mesh.position
          const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
          const curve = new THREE.QuadraticBezierCurve3(
            from.clone(),
            mid.clone().add(new THREE.Vector3((Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5)),
            to.clone()
          )
          const pts = curve.getPoints(20)
          const edgeGeom = new THREE.BufferGeometry().setFromPoints(pts)
          const edgeLine = new THREE.Line(edgeGeom, new THREE.LineBasicMaterial({
            color: new THREE.Color(nodes[i].mesh.userData.color),
            transparent: true,
            opacity: 0.15 + weight * 0.2,
          }))
          edgeGroup.add(edgeLine)
        }
      }
    }
    scene.add(edgeGroup)

    // Mouse state
    let isDragging = false, prevX = 0, prevY = 0
    let rotH = 0.5, rotV = 0.3
    let zoom = 60, targetZoom = 60
    const targetRotH = { val: rotH }
    const targetRotV = { val: rotV }
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Input
    canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY })
    canvas.addEventListener('mousemove', e => {
      if (isDragging) {
        targetRotH.val += (e.clientX - prevX) * 0.004
        targetRotV.val += (e.clientY - prevY) * 0.004
        targetRotV.val = Math.max(-1.5, Math.min(1.5, targetRotV.val))
        prevX = e.clientX; prevY = e.clientY
      }
      // Hover
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(nodes.map(n => n.mesh))
      if (hits.length > 0) {
        const topic = hits[0].object.userData?.topic
        setHoveredLabel(topic?.name?.slice(0, 40) || '')
      } else {
        setHoveredLabel('')
      }
    })
    canvas.addEventListener('mouseup', e => {
      if (isDragging && Math.abs(e.clientX - prevX) < 3 && Math.abs(e.clientY - prevY) < 3) {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(nodes.map(n => n.mesh))
        if (hits.length > 0) {
          const topic = hits[0].object.userData?.topic
          if (topic) onSelectTopic(topic)
        }
      }
      isDragging = false
    })
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      targetZoom = Math.max(15, Math.min(120, targetZoom + e.deltaY * 0.05))
    }, { passive: false })
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY }
    })
    canvas.addEventListener('touchmove', e => {
      if (isDragging && e.touches.length === 1) {
        targetRotH.val += (e.touches[0].clientX - prevX) * 0.004
        targetRotV.val += (e.touches[0].clientY - prevY) * 0.004
        targetRotV.val = Math.max(-1.5, Math.min(1.5, targetRotV.val))
        prevX = e.touches[0].clientX; prevY = e.touches[0].clientY
      }
    })
    canvas.addEventListener('touchend', () => { isDragging = false })

    // Resize
    const onResize = () => {
      const w2 = canvas.clientWidth, h2 = canvas.clientHeight || 500
      camera.aspect = w2 / h2; camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    window.addEventListener('resize', onResize)

    // Animate
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)

      rotH += (targetRotH.val - rotH) * 0.08
      rotV += (targetRotV.val - rotV) * 0.08
      zoom += (targetZoom - zoom) * 0.08

      const camX = zoom * Math.cos(rotV) * Math.sin(rotH)
      const camY = zoom * Math.sin(rotV)
      const camZ = zoom * Math.cos(rotV) * Math.cos(rotH)
      camera.position.set(camX, camY, camZ)
      camera.lookAt(0, 0, 0)

      // Pulse rings toward camera
      for (const n of nodes) {
        if (n.ring) {
          n.ring.position.copy(n.mesh.position)
          n.ring.lookAt(camera.position)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.clear()
    }
  }, [topics, onSelectTopic])

  useEffect(() => {
    let cleanupFn: (() => void) | undefined
    init().then(fn => { cleanupFn = fn })
    return () => { cleanupFn?.() }
  }, [init])

  return (
    <div className="relative w-full rounded-xl overflow-hidden cursor-grab active:cursor-grabbing" style={{ height: '500px', backgroundColor: 'var(--bg-deep)' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0">
        {hoveredLabel && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border text-[13px] font-medium whitespace-nowrap"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text)',
              fontFamily: "'Hanken Grotesk', sans-serif",
              boxShadow: 'var(--shadow-card)',
            }}>
            {hoveredLabel}
          </div>
        )}
      </div>
      {topics.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p style={{ color: 'var(--text-muted)' }}>No topics to visualize</p>
        </div>
      )}
    </div>
  )
}
