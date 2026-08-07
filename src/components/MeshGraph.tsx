import { useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { Topic } from '../types'
import { PLATFORM_COLORS } from '../hooks'

interface Props {
  topics: Topic[]
  onSelectTopic: (t: Topic) => void
}

// Smaller canvas per-node text rendering
const NODE_LABEL_CANVAS = typeof document !== 'undefined' ? document.createElement('canvas') : null

function renderTextTexture(text: string): string | null {
  if (!NODE_LABEL_CANVAS) return null
  const c = NODE_LABEL_CANVAS
  c.width = 512; c.height = 64
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#dae2fd'
  ctx.font = 'bold 28px "Hanken Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.slice(0, 30), c.width / 2, c.height / 2)
  return c.toDataURL()
}

function extractKeywords(name: string): string[] {
  const stop = new Set(['this','that','with','from','have','been','were','they','them','about','into','over','also','then','than','just','like','some','other','only','more','very','will','what','when','which','would','could','there','their','should','because','through','between'])
  return [...new Set(
    name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !stop.has(w)).slice(0, 5)
  )]
}

export function MeshGraph({ topics, onSelectTopic }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<any>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || topics.length === 0) return

    // Cleanup previous
    if (ctxRef.current) {
      cancelAnimationFrame(animRef.current)
      ctxRef.current.dispose?.()
      mount.innerHTML = ''
    }

    const loadTHREE = async () => {
      // Dynamic import to avoid bundle bloat
      const THREE = await import('three')
      
      const container = mount
      const w = container.clientWidth
      const h = container.clientHeight || 500

      const scene = new THREE.Scene()
      scene.background = null // transparent

      const camera = new THREE.PerspectiveCamera(45, w / h, 1, 1000)
      camera.position.set(0, 0, 80)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      container.appendChild(renderer.domElement)

      // Lights
      scene.add(new THREE.AmbientLight(0x404060, 2))
      const dLight = new THREE.DirectionalLight(0x7c3aed, 1.5)
      dLight.position.set(10, 10, 10)
      scene.add(dLight)
      const dLight2 = new THREE.DirectionalLight(0x00a572, 1)
      dLight2.position.set(-10, -5, -5)
      scene.add(dLight2)

      // Particle background
      const pGeom = new THREE.BufferGeometry()
      const pCount = 500
      const pPositions = new Float32Array(pCount * 3)
      for (let i = 0; i < pCount * 3; i += 3) {
        pPositions[i] = (Math.random() - 0.5) * 120
        pPositions[i + 1] = (Math.random() - 0.5) * 120
        pPositions[i + 2] = (Math.random() - 0.5) * 120
      }
      pGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
      const pMat = new THREE.PointsMaterial({ color: 0x4a4455, size: 0.3, transparent: true, opacity: 0.5 })
      const particles = new THREE.Points(pGeom, pMat)
      scene.add(particles)

      // Build nodes
      const limit = Math.min(topics.length, 60)
      const sliced = topics.slice(0, limit)
      const kwMap = sliced.map(t => extractKeywords(t.name))

      // Position nodes in a sphere
      const nodes: any[] = []
      const nodeMap = new Map<string, any>()

      for (let i = 0; i < sliced.length; i++) {
        const t = sliced[i]
        const phi = Math.acos(-1 + (2 * (i + 0.5)) / sliced.length)
        const theta = Math.sqrt(sliced.length * Math.PI) * phi
        const radius = 25 + Math.random() * 15

        const x = radius * Math.sin(phi) * Math.cos(theta)
        const y = radius * Math.sin(phi) * Math.sin(theta)
        const z = radius * Math.cos(phi)

        const size = Math.max(1, Math.min(6, Math.log(t.message_count_exported + 1) * 1.2))
        const pc = PLATFORM_COLORS[t.platforms?.[0] || '']
        const color = pc?.dot || '#958da1'

        const geom = new THREE.SphereGeometry(size, 32, 32)
        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.3,
          specular: new THREE.Color(0xffffff),
          shininess: 30,
        })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, y, z)
        mesh.userData = { topic: t, size, color, baseX: x, baseY: y, baseZ: z }

        scene.add(mesh)
        nodes.push(mesh)
        nodeMap.set(t.id, mesh)
      }

      // Build edges
      const edges: [any, any, number][] = []
      for (let i = 0; i < sliced.length; i++) {
        for (let j = i + 1; j < sliced.length; j++) {
          const a = new Set(kwMap[i])
          const b = new Set(kwMap[j])
          if (a.size === 0 || b.size === 0) continue
          const intersection = [...a].filter(x => b.has(x)).length
          const union = a.size + b.size - intersection
          const weight = intersection / union
          if (weight >= 0.2) {
            edges.push([nodes[i], nodes[j], weight])
          }
        }
      }

      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4a4455, transparent: true, opacity: 0.3 })
      const edgeLines: any[] = []
      for (const [a, b, weight] of edges) {
        const points = [a.position.clone(), b.position.clone()]
        const geom = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geom, lineMaterial.clone())
        line.userData = { nodeA: a, nodeB: b, weight }
        scene.add(line)
        edgeLines.push(line)
      }

      // Orbit state
      let isDragging = false
      let prevX = 0, prevY = 0
      let rotX = 0, rotY = 0
      let zoom = 80
      let targetZoom = 80
      const targetRotX = { val: 0 }
      const targetRotY = { val: 0 }

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      // Mouse events
      const onDown = (e: MouseEvent) => {
        isDragging = true
        prevX = e.clientX
        prevY = e.clientY
      }
      const onMove = (e: MouseEvent) => {
        if (isDragging) {
          const dx = e.clientX - prevX
          const dy = e.clientY - prevY
          targetRotY.val += dx * 0.005
          targetRotX.val += dy * 0.005
          prevX = e.clientX
          prevY = e.clientY
        }

        // Hover detection
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(nodes)
        let hovered: any = null
        if (intersects.length > 0) {
          hovered = intersects[0].object
        }
        for (const n of nodes) {
          const mat = n.material as THREE.MeshPhongMaterial
          if (n === hovered) {
            mat.emissiveIntensity = 0.8
            n.scale.setScalar(n.userData === selected ? 1.5 : 1.15)
          } else {
            mat.emissiveIntensity = n.userData === selected ? 0.6 : 0.3
            n.scale.setScalar(n.userData === selected ? 1.5 : 1)
          }
        }
      }
      const onUp = (e: MouseEvent) => {
        if (isDragging && Math.abs(e.clientX - prevX) < 3 && Math.abs(e.clientY - prevY) < 3) {
          // Click — detect
          const rect = renderer.domElement.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const intersects = raycaster.intersectObjects(nodes)
          if (intersects.length > 0) {
            const node = intersects[0].object as any
            const topic = node.userData?.topic
            if (topic) {
              setSelected(topic.id)
              targetZoom = 25
              // Animate camera toward node
              setSelected(topic.id)
              setTimeout(() => onSelectTopic(topic), 600)
            }
          }
        }
        isDragging = false
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        targetZoom = Math.max(15, Math.min(150, targetZoom + e.deltaY * 0.1))
      }

      renderer.domElement.addEventListener('mousedown', onDown)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

      // Animation loop
      const animate = () => {
        animRef.current = requestAnimationFrame(animate)

        // Smooth rotation
        rotX += (targetRotX.val - rotX) * 0.1
        rotY += (targetRotY.val - rotY) * 0.1
        zoom += (targetZoom - zoom) * 0.1

        // Rotate the node group (rotate scene around origin)
        const group = new THREE.Group()
        for (const n of nodes) {
          group.add(n)
        }
        
        // Camera orbit
        const camX = zoom * Math.sin(rotY) * Math.cos(rotX)
        const camY = zoom * Math.sin(rotX)
        const camZ = zoom * Math.cos(rotY) * Math.cos(rotX)
        camera.position.set(camX, camY, camZ)
        camera.lookAt(0, 0, 0)

        // Update edge lines
        for (const line of edgeLines) {
          const a = line.userData.nodeA
          const b = line.userData.nodeB
          const points = [a.position.clone(), b.position.clone()]
          line.geometry.dispose()
          line.geometry = new THREE.BufferGeometry().setFromPoints(points)
        }

        // Rotate particles slowly
        particles.rotation.y += 0.0003
        particles.rotation.x += 0.0002

        renderer.render(scene, camera)
      }
      animate()

      // Resize
      const onResize = () => {
        const w2 = container.clientWidth
        const h2 = container.clientHeight || 500
        camera.aspect = w2 / h2
        camera.updateProjectionMatrix()
        renderer.setSize(w2, h2)
      }
      window.addEventListener('resize', onResize)

      ctxRef.current = {
        dispose: () => {
          cancelAnimationFrame(animRef.current)
          window.removeEventListener('resize', onResize)
          renderer.domElement.removeEventListener('mousedown', onDown)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          renderer.domElement.removeEventListener('wheel', onWheel)
          renderer.dispose()
          scene.clear()
        }
      }
    }

    loadTHREE()

    return () => {
      if (ctxRef.current) {
        ctxRef.current.dispose()
        ctxRef.current = null
      }
    }
  }, [topics])

  return (
    <div ref={mountRef} className="w-full rounded-xl overflow-hidden cursor-grab active:cursor-grabbing" style={{ height: '500px', backgroundColor: 'var(--bg-deep)' }}>
      {topics.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p style={{ color: 'var(--text-muted)' }}>No topics to visualize</p>
        </div>
      )}
    </div>
  )
}
