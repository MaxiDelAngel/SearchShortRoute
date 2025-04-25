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
    pathLine = null // Reiniciar el pathLine
  }

  // Llamada a la API de OSRM para obtener la ruta real
  fetchOSRMRoute(startPoint, endPoint)
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

function fetchOSRMRoute(start, end) {
  const startLon = start.lng;
  const startLat = start.lat;
  const endLon = end.lng;
  const endLat = end.lat;

  const url = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=polyline`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const polyline = decodePolyline(route.geometry);
        pathLine = L.polyline(polyline, {
          color: "blue",
          weight: 5,
          opacity: 0.7,
        }).addTo(map);

        map.fitBounds(pathLine.getBounds(), { padding: [50, 50] });

        let total = 0;
        for (let i = 1; i < polyline.length; i++) {
          total += distance(polyline[i - 1], polyline[i]);
        }

        totalDistance.textContent = `Distancia total: ${(total * 1000).toFixed(0)} metros`;
        routeInfo.style.display = "block";
        infoCard.style.display = "none";
      } else {
        showError("No se pudo encontrar una ruta entre los puntos seleccionados.");
      }
    })
    .catch(error => {
      showError("Error al calcular la ruta: " + error.message);
    })
}

function decodePolyline(encoded) {
  const polyline = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let shift = 0, result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    polyline.push([lat / 1e5, lng / 1e5]);
  }
  return polyline;
}

function distance(a, b) {
  return heuristic(a, b)
}

function heuristic(a, b) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}
