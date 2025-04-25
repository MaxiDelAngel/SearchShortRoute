const map = L.map("map").setView([22.3000, -97.8667], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

let startPoint = null
let endPoint = null
let startMarker = null
let endMarker = null
let pathLine = null
let mode = "start" // 'start', 'end', o 'view'
let isCalculating = false

const modeStatus = document.getElementById("mode-status")
const calculateBtn = document.getElementById("calculate-btn")
const resetBtn = document.getElementById("reset-btn")
const errorMessage = document.getElementById("error-message")
const routeInfo = document.getElementById("route-info")
const totalDistance = document.getElementById("total-distance")
const directionsList = document.getElementById("directions-list")
const infoCard = document.getElementById("info-card")

map.on("click", (e) => {
  const { lat, lng } = e.latlng

  if (mode === "start") {
    startPoint = { lat, lng }

    if (startMarker) {
      map.removeLayer(startMarker)
    }

    startMarker = L.marker([lat, lng]).addTo(map)
    startMarker.bindPopup("Punto de inicio").openPopup()

    mode = "end"
    modeStatus.textContent = "Modo actual: Seleccionar punto final"
  } else if (mode === "end") {
    endPoint = { lat, lng }

    if (endMarker) {
      map.removeLayer(endMarker)
    }

    endMarker = L.marker([lat, lng]).addTo(map)
    endMarker.bindPopup("Punto final").openPopup()

    mode = "view"
    modeStatus.textContent = "Modo actual: Ver ruta"
    calculateBtn.disabled = false

    routeInfo.style.display = "none"
    infoCard.style.display = "block"
  }
})
calculateBtn.addEventListener("click", () => {
  console.log(startPoint, endPoint)
  if (!startPoint || !endPoint) {
    showError("Por favor selecciona un punto de inicio y un punto final.")
    return
  }

  isCalculating = true
  calculateBtn.disabled = true
  calculateBtn.textContent = "Calculando..."
  hideError()

  if (pathLine) {
    map.removeLayer(pathLine)
    pathLine = null   
  }

  // Calcular ruta usando A*
  try {
    const path = aStar([], startPoint, endPoint)

    if (path.length > 0) {
      pathLine = L.polyline(
        path.map((p) => [p.lat, p.lng]),
        {
          color: "blue",
          weight: 5,
          opacity: 0.7,
        },
      ).addTo(map)

      map.fitBounds(pathLine.getBounds(), { padding: [50, 50] })

      let total = 0
      for (let i = 1; i < path.length; i++) {
        total += distance(path[i - 1], path[i])
      }

      const directions = generateDirections(path)

      totalDistance.textContent = `Distancia total: ${(total * 1000).toFixed(0)} metros`

      directionsList.innerHTML = ""
      directions.forEach((dir) => {
        const li = document.createElement("li")
        li.textContent = dir.text
        directionsList.appendChild(li)
      })

      routeInfo.style.display = "block"
      infoCard.style.display = "none"
    } else {
      showError("No se pudo encontrar una ruta entre los puntos seleccionados.")
    }
  } catch (err) {
    showError("Error al calcular la ruta: " + err.message)
  } finally {
    isCalculating = false
    calculateBtn.disabled = false
    calculateBtn.textContent = "Calcular Ruta"
  }
})

resetBtn.addEventListener("click", () => {
  if (startMarker) map.removeLayer(startMarker)
  if (endMarker) map.removeLayer(endMarker)
  if (pathLine) map.removeLayer(pathLine)

  startPoint = null
  endPoint = null
  startMarker = null
  endMarker = null
  pathLine = null
  mode = "start"

  modeStatus.textContent = "Modo actual: Seleccionar punto de inicio"
  calculateBtn.disabled = true
  hideError()
  routeInfo.style.display = "none"
  infoCard.style.display = "none"
})

function showError(message) {
  errorMessage.textContent = message
  errorMessage.style.display = "block"
}

function hideError() {
  errorMessage.style.display = "none"
}

// Implementación del algoritmo A*
function aStar(grid, start, end) {
  const openSet = [start]
  const closedSet = []
  const cameFrom = {}

  const gScore = {}
  gScore[`${start.lat},${start.lng}`] = 0

  const fScore = {}
  fScore[`${start.lat},${start.lng}`] = heuristic(start, end)

  const maxIterations = 10000
  let iterations = 0

  while (openSet.length > 0 && iterations < maxIterations) {
    const current = lowestFScore(openSet, fScore)

    if (Math.abs(current.lat - end.lat) < 0.0001 && Math.abs(current.lng - end.lng) < 0.0001) {
      return reconstructPath(cameFrom, current)
    }

    openSet.splice(openSet.indexOf(current), 1)
    closedSet.push(current)

    const neighbors = getNeighbors(current, grid)

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.lat},${neighbor.lng}`

      if (closedSet.some((p) => Math.abs(p.lat - neighbor.lat) < 0.0001 && Math.abs(p.lng - neighbor.lng) < 0.0001)) {
        continue
      }

      const tentativeGScore = gScore[`${current.lat},${current.lng}`] + distance(current, neighbor)

      if (!openSet.some((p) => Math.abs(p.lat - neighbor.lat) < 0.0001 && Math.abs(p.lng - neighbor.lng) < 0.0001)) {
        openSet.push(neighbor)
      } else if (tentativeGScore >= (gScore[neighborKey] || Number.POSITIVE_INFINITY)) {
        continue
      }

      cameFrom[neighborKey] = current
      gScore[neighborKey] = tentativeGScore
      fScore[neighborKey] = gScore[neighborKey] + heuristic(neighbor, end)
    }

    iterations++
  }

  if (iterations >= maxIterations) {
    showError("Demasiadas iteraciones. No se pudo encontrar una ruta.")
  }

  return []
}

function lowestFScore(openSet, fScore) {
  let lowest = openSet[0]
  let lowestScore = fScore[`${lowest.lat},${lowest.lng}`] || Number.POSITIVE_INFINITY

  for (const point of openSet) {
    const score = fScore[`${point.lat},${point.lng}`] || Number.POSITIVE_INFINITY
    if (score < lowestScore) {
      lowest = point
      lowestScore = score
    }
  }

  return lowest
}

function heuristic(a, b) {
  const R = 6371 // Radio de la Tierra en km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

function distance(a, b) {
  return heuristic(a, b)
}

function getNeighbors(point, grid) {
  const neighbors = []
  const step = 0.001

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue

      const neighbor = {
        lat: point.lat + i * step,
        lng: point.lng + j * step,
      }

      neighbors.push(neighbor)
    }
  }
  
  return neighbors
}

function reconstructPath(cameFrom, current) {
  const path = [current]
  let key = `${current.lat},${current.lng}`

  while (cameFrom[key]) {
    current = cameFrom[key]
    path.unshift(current)
    key = `${current.lat},${current.lng}`
  }

  return path
}

function generateDirections(path) {
  if (path.length < 2) return []

  const directions = []

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]

    const bearing = calculateBearing(prev, curr)
    const dist = distance(prev, curr)

    let direction = ""

    if (bearing >= 337.5 || bearing < 22.5) {
      direction = "norte"
    } else if (bearing >= 22.5 && bearing < 67.5) {
      direction = "noreste"
    } else if (bearing >= 67.5 && bearing < 112.5) {
      direction = "este"
    } else if (bearing >= 112.5 && bearing < 157.5) {
      direction = "sureste"
    } else if (bearing >= 157.5 && bearing < 202.5) {
      direction = "sur"
    } else if (bearing >= 202.5 && bearing < 247.5) {
      direction = "suroeste"
    } else if (bearing >= 247.5 && bearing < 292.5) {
      direction = "oeste"
    } else {
      direction = "noroeste"
    }

    directions.push({
      text: `Continúa hacia el ${direction} por ${(dist * 1000).toFixed(0)} metros`,
      distance: dist,
    })
  }

  return directions
}

function calculateBearing(start, end) {
  const startLat = (start.lat * Math.PI) / 180
  const startLng = (start.lng * Math.PI) / 180
  const endLat = (end.lat * Math.PI) / 180
  const endLng = (end.lng * Math.PI) / 180

  const y = Math.sin(endLng - startLng) * Math.cos(endLat)
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng)

  let bearing = (Math.atan2(y, x) * 180) / Math.PI
  if (bearing < 0) {
    bearing += 360
  }

  return bearing
}
