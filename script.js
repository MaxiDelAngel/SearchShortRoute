const map = L.map("map").setView([22.3000, -97.8667], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let pathLine = null;
let mode = "start"; // 'start', 'end', o 'view'
let isCalculating = false;
const useGraphHopper = false; // true para usar GraphHopper, false para usar A*.

const modeStatus = document.getElementById("mode-status");
const calculateBtn = document.getElementById("calculate-btn");
const resetBtn = document.getElementById("reset-btn");
const errorMessage = document.getElementById("error-message");
const routeInfo = document.getElementById("route-info");
const totalDistance = document.getElementById("total-distance");
const directionsList = document.getElementById("directions-list");
const infoCard = document.getElementById("info-card");

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
  console.log("variables globales", startPoint, endPoint);
  isCalculating = true;
  calculateBtn.disabled = true;
  calculateBtn.textContent = "Calculando...";
  hideError();

  if (pathLine) {
    map.removeLayer(pathLine);
    pathLine = null; 
  }

  directionsList.innerHTML = "";

  if (useGraphHopper) {
    fetchGraphHopperRoute(startPoint, endPoint);
  } else {
    const path = aStar([], startPoint, endPoint);
    if (path.length > 0) {
      pathLine = L.polyline(
        path.map((p) => [p.lat, p.lng]),
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
      
      isCalculating = false;
      calculateBtn.disabled = false;
      calculateBtn.textContent = "Calcular Ruta";
    } else {
      showError("No se pudo encontrar una ruta entre los puntos seleccionados.");
      isCalculating = false;
      calculateBtn.disabled = false;
      calculateBtn.textContent = "Calcular Ruta";
    }
  }
});

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
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function hideError() {
  errorMessage.style.display = "none";
}

function fetchGraphHopperRoute(start, end) {
  const startLon = start.lng;
  const startLat = start.lat;
  const endLon = end.lng;
  const endLat = end.lat;

  const apiKey = "eb7a6d4a-3df9-4c8b-80da-4d86e4645c87"; 
  const url = `https://graphhopper.com/api/1/route?point=${startLat},${startLon}&point=${endLat},${endLon}&vehicle=car&key=${apiKey}&instructions=true&locale=es&calc_points=true&points_encoded=true`;

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.paths && data.paths.length > 0) {
        const route = data.paths[0]; 
        const polyline = decodePolyline(route.points);
        
        pathLine = L.polyline(
          polyline.map((p) => [p[0], p[1]]),
          { color: "blue", weight: 5, opacity: 0.7 }
        ).addTo(map);

        map.fitBounds(pathLine.getBounds(), { padding: [50, 50] });

        const distance = route.distance > 1000 
          ? `${(route.distance / 1000).toFixed(1)} km` 
          : `${Math.round(route.distance)} m`;
        
        const timeInMinutes = Math.round(route.time / 60000);
        totalDistance.textContent = `Distancia total: ${distance} (${timeInMinutes} min)`;
        
        if (route.instructions) {
          displayDirections(route.instructions);
        }
        
        routeInfo.style.display = "block";
        infoCard.style.display = "none";
      } else {
        showError("No se pudo encontrar una ruta entre los puntos seleccionados.");
      }
    })
    .catch((error) => {
      console.error("Error en la API de GraphHopper:", error);
      showError("Error al calcular la ruta: " + error.message);
    })
    .finally(() => {
      isCalculating = false;
      calculateBtn.disabled = false;
      calculateBtn.textContent = "Calcular Ruta";
    });
}

function displayDirections(instructions) {
  directionsList.innerHTML = "";

  if (!instructions || instructions.length === 0) {
    directionsList.innerHTML = "<li>No hay instrucciones disponibles</li>";
    return;
  }

  instructions.forEach((instruction, index) => {
    if (instruction.text === "Continue") {
      instruction.text = "Continúa recto";
    }
    
    const li = document.createElement("li");
    
    const distance = instruction.distance > 1000
      ? `${(instruction.distance / 1000).toFixed(1)} km`
      : `${Math.round(instruction.distance)} m`;
    
    let icon = "➡️";
    
    if (instruction.sign === 0) icon = "➡️"; 
    if (instruction.sign === 1) icon = "↗️"; 
    if (instruction.sign === 2) icon = "➡️"; 
    if (instruction.sign === 3) icon = "↘️";
    if (instruction.sign === 4) icon = "⬇️"; 
    if (instruction.sign === 5) icon = "↙️"; 
    if (instruction.sign === 6) icon = "⬅️"; 
    if (instruction.sign === 7) icon = "↖️";
    if (instruction.sign === 8) icon = "🏁"; 
    
    li.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 1.2em; margin-right: 10px;">${icon}</span>
        <div>
          <p style="margin: 0; font-weight: ${instruction.sign === 8 ? 'bold' : 'normal'};">${instruction.text}</p>
          <span style="color: #666; font-size: 0.9em;">${distance}</span>
        </div>
      </div>
    `;
    
    directionsList.appendChild(li);
  });
}

function decodePolyline(encoded) {
  const polyline = [];
  let index = 0;
  let len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let shift = 0,
      result = 0;
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
  return heuristic(a, b);
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
    const prev = path[i-1];
    const current = path[i];
    const next = path[i+1];
    
    const currentBearing = calculateBearing(prev, current);
    const nextBearing = calculateBearing(current, next);
    
    let change = nextBearing - currentBearing;
    if (change > 180) change -= 360;
    if (change < -180) change += 360;
    
    if (Math.abs(change) > 20) {
      const direction = getDirectionText(change);
      const icon = getDirectionIcon(change);
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
  const startLat = start.lat * Math.PI / 180;
  const startLng = start.lng * Math.PI / 180;
  const endLat = end.lat * Math.PI / 180;
  const endLng = end.lng * Math.PI / 180;
  
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  
  return bearing;
}

function getDirectionText(change) {
  if (change > 45 && change < 135) {
    return "Gira a la derecha";
  } else if (change >= 135 || change <= -135) {
    return "Da media vuelta";
  } else if (change < -45 && change > -135) {
    return "Gira a la izquierda";
  } else {
    return "Continúa recto";
  }
}

function getDirectionIcon(change) {
  if (change > 45 && change < 135) {
    return "➡️";
  } else if (change >= 135 || change <= -135) {
    return "⬇️";
  } else if (change < -45 && change > -135) {
    return "⬅️";
  } else {
    return "⬆️";
  }
}

function getNeighbors(point, grid) {
  const neighbors = [];
  const step = 0.0005;
  
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      
      const neighbor = {
        lat: point.lat + i * step,
        lng: point.lng + j * step,
      };
      
      neighbors.push(neighbor);
    }
  }
  
  return neighbors;
}

function reconstructPath(cameFrom, current) {
  const totalPath = [current];
  let currentKey = `${current.lat},${current.lng}`;
  
  while (cameFrom[currentKey]) {
    current = cameFrom[currentKey];
    totalPath.unshift(current);
    currentKey = `${current.lat},${current.lng}`;
  }
  
  return totalPath;
}

function lowestFScore(openSet, fScore) {
  let lowest = openSet[0];
  let lowestScore = fScore[`${lowest.lat},${lowest.lng}`] || Number.POSITIVE_INFINITY;

  for (const point of openSet) {
    const score = fScore[`${point.lat},${point.lng}`] || Number.POSITIVE_INFINITY;
    if (score < lowestScore) {
      lowest = point;
      lowestScore = score;
    }
  }

  return lowest;
}

function aStar(grid, start, end) {
  const openSet = [start];
  const closedSet = [];
  const cameFrom = {};

  const gScore = {};
  gScore[`${start.lat},${start.lng}`] = 0;

  const fScore = {};
  fScore[`${start.lat},${start.lng}`] = heuristic(start, end);

  const maxIterations = 20000;
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    const current = lowestFScore(openSet, fScore);
    
    const distanceToEnd = heuristic(current, end);
    if (distanceToEnd < 0.05) {
      return reconstructPath(cameFrom, current);
    }

    const currentIndex = openSet.findIndex(
      p => p.lat === current.lat && p.lng === current.lng
    );
    
    if (currentIndex !== -1) {
      openSet.splice(currentIndex, 1);
    } else {
      openSet.splice(openSet.indexOf(current), 1);
    }
    
    closedSet.push(current);

    const neighbors = getNeighbors(current, grid);

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.lat},${neighbor.lng}`;
      
      if (closedSet.some(p => 
        Math.abs(p.lat - neighbor.lat) < 0.0001 && 
        Math.abs(p.lng - neighbor.lng) < 0.0001)) {
        continue;
      }

      const tentativeGScore = 
        gScore[`${current.lat},${current.lng}`] + 
        heuristic(current, neighbor);

      const inOpenSet = openSet.some(p => 
        Math.abs(p.lat - neighbor.lat) < 0.0001 && 
        Math.abs(p.lng - neighbor.lng) < 0.0001);
      
      if (!inOpenSet) {
        openSet.push(neighbor);
      } else if (tentativeGScore >= (gScore[neighborKey] || Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom[neighborKey] = current;
      gScore[neighborKey] = tentativeGScore;
      fScore[neighborKey] = gScore[neighborKey] + heuristic(neighbor, end);
    }

    iterations++;
  }

  return [];
}