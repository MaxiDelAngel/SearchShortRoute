const map = L.map("map").setView([22.3000, -97.8667], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let pathLine = null;
let mode = "start";
let isCalculating = false;

const modeStatus = document.getElementById("mode-status");
const calculateBtn = document.getElementById("calculate-btn");
const resetBtn = document.getElementById("reset-btn");
const errorMessage = document.getElementById("error-message");
const routeInfo = document.getElementById("route-info");
const totalDistance = document.getElementById("total-distance");
const directionsList = document.getElementById("directions-list");
const infoCard = document.getElementById("info-card");

let startTime, endTime;

// Evento de clic en el mapa
map.on("click", (e) => {
  const { lat, lng } = e.latlng;

  if (mode === "start") {
    startPoint = { lat, lng };

    if (startMarker) {
      map.removeLayer(startMarker);
    }

    startMarker = L.marker([lat, lng]).addTo(map);
    startMarker.bindPopup("Punto de inicio").openPopup();

    mode = "end";
    modeStatus.textContent = "Modo actual: Seleccionar punto final";
  } else if (mode === "end") {
    endPoint = { lat, lng };

    if (endMarker) {
      map.removeLayer(endMarker);
    }

    endMarker = L.marker([lat, lng]).addTo(map);
    endMarker.bindPopup("Punto final").openPopup();

    mode = "view";
    modeStatus.textContent = "Modo actual: Ver ruta";
    calculateBtn.disabled = false;

    routeInfo.style.display = "none";
    infoCard.style.display = "block";
  }
});

calculateBtn.addEventListener("click", () => {
  if (!startPoint || !endPoint) {
    showError("Por favor selecciona un punto de inicio y un punto final.");
    return;
  }

  startTime = new Date().getTime();  
  document.getElementById("calculation-time").style.display = "block";  

  isCalculating = true;
  calculateBtn.disabled = true;
  calculateBtn.textContent = "Calculando...";
  hideError();

  if (pathLine) {
    map.removeLayer(pathLine);
    pathLine = null;
  }

  directionsList.innerHTML = "";

  fetch('http://127.0.0.1:5000/calculate_route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lat: startPoint.lat,
      start_lon: startPoint.lng,
      end_lat: endPoint.lat,
      end_lon: endPoint.lng,
      use_astar: true // True si se quiere usar A* y False si se quiere usar Dijkstra
    })
  })
  .then(response => response.json())
  .then(data => {
    const path = data.route;
    if (path && path.length > 0) {
      pathLine = L.polyline(
        path.map((p) => [p[0], p[1]]),
        {
          color: "blue",
          weight: 5,
          opacity: 0.7,
        }
      ).addTo(map);

      map.fitBounds(pathLine.getBounds(), { padding: [50, 50] });

      let total = 0;
      for (let i = 1; i < path.length; i++) {
        total += distance(path[i - 1], path[i]);
      }

      totalDistance.textContent = `Distancia total: ${(total * 1000).toFixed(0)} metros`;

      generateSimpleDirections(path);

      routeInfo.style.display = "block";
      infoCard.style.display = "none";

      // Calcular el tiempo de ejecución
      endTime = new Date().getTime();  // Guardamos el tiempo final
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2); // Tiempo en segundos
      document.getElementById("time-display").textContent = timeTaken; // Mostrar tiempo

      isCalculating = false;
      calculateBtn.disabled = false;
      calculateBtn.textContent = "Calcular Ruta";
    } else {
      showError("No se pudo encontrar una ruta entre los puntos seleccionados.");
      isCalculating = false;
      calculateBtn.disabled = false;
      calculateBtn.textContent = "Calcular Ruta";
    }
  })
  .catch(error => {
    showError("Error al calcular la ruta: " + error.message);
    isCalculating = false;
    calculateBtn.disabled = false;
    calculateBtn.textContent = "Calcular Ruta";
  });
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function hideError() {
  errorMessage.style.display = "none";
}

function distance(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;

  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c; 
}

function generateSimpleDirections(path) {
  directionsList.innerHTML = "";
  
  if (path.length < 2) {
    directionsList.innerHTML = "<li>No hay suficientes puntos para generar instrucciones</li>";
    return;
  }

  let li = document.createElement("li");
  li.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 1.2em; margin-right: 10px;">🚩</span>
      <div>
        <p style="margin: 0;">Comienza en el punto de inicio</p>
      </div>
    </div>
  `;
  directionsList.appendChild(li);

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];

    const currentBearing = calculateBearing(prev, current);
    const nextBearing = calculateBearing(current, next);
    
    let change = nextBearing - currentBearing;
    if (change > 180) change -= 360;
    if (change < -180) change += 360;

    let direction = "Continúa recto";
    let icon = "⬆️";
    if (Math.abs(change) > 45) {
      if (change > 0) {
        direction = "Gira a la derecha";
        icon = "➡️";
      } else if (change < 0) {
        direction = "Gira a la izquierda";
        icon = "⬅️";
      }
    }

    const dist = distance(current, next) * 1000; 

    li = document.createElement("li");
    li.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 1.2em; margin-right: 10px;">${icon}</span>
        <div>
          <p style="margin: 0;">${direction}</p>
          <span style="color: #666; font-size: 0.9em;">${Math.round(dist)} m</span>
        </div>
      </div>
    `;
    directionsList.appendChild(li);
  }

  li = document.createElement("li");
  li.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 1.2em; margin-right: 10px;">🏁</span>
      <div>
        <p style="margin: 0; font-weight: bold;">Llegada al destino</p>
      </div>
    </div>
  `;
  directionsList.appendChild(li);
}

function calculateBearing(start, end) {
  const startLat = start[0] * Math.PI / 180;
  const startLng = start[1] * Math.PI / 180;
  const endLat = end[0] * Math.PI / 180;
  const endLng = end[1] * Math.PI / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  
  return bearing;
}

resetBtn.addEventListener("click", () => {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (pathLine) map.removeLayer(pathLine);

  startPoint = null;
  endPoint = null;
  startMarker = null;
  endMarker = null;
  pathLine = null;
  mode = "start";

  modeStatus.textContent = "Modo actual: Seleccionar punto de inicio";
  calculateBtn.disabled = true;
  hideError();
  routeInfo.style.display = "none";
  infoCard.style.display = "none";
  directionsList.innerHTML = "";

  document.getElementById("calculation-time").style.display = "none"; 
});
