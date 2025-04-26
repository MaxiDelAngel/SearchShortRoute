from flask import Flask, request, jsonify
import osmnx as ox
import networkx as nx
import math
from flask_cors import CORS 

app = Flask(__name__)
CORS(app)

place_name = "Tampico, Mexico" # Pongo restricción para solamente pasar por caminos para vehiculos de la ciudad de Tampico
graph = ox.graph_from_place(place_name, network_type='drive') # Cambiar a all para incluir caminos peatonales y ciclistas

# Función heurística para A*
def heuristic(u, v):
    lat1, lon1 = graph.nodes[u]['y'], graph.nodes[u]['x']
    lat2, lon2 = graph.nodes[v]['y'], graph.nodes[v]['x']

    R = 6371  
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c 

# Ruta 
@app.route('/calculate_route', methods=['POST'])
def calculate_route():
    data = request.get_json()  
    start_lat = data['start_lat']
    start_lon = data['start_lon']
    end_lat = data['end_lat']
    end_lon = data['end_lon']
    use_astar = data.get('use_astar', False)  #True si se quiere usar A* y False si se quiere usar Dijkstra

    start_node = ox.distance.nearest_nodes(graph, X=start_lon, Y=start_lat)
    end_node = ox.distance.nearest_nodes(graph, X=end_lon, Y=end_lat)

    if use_astar:
        # Libreria que hace la busqueda A*
        shortest_path = nx.astar_path(graph, source=start_node, target=end_node, weight='length', heuristic=heuristic)
    else:
        # Libreria que hace la busqueda Dijkstra
        shortest_path = nx.shortest_path(graph, source=start_node, target=end_node, weight='length')

    # Obtener las coordenadas de los nodos en la ruta
    route_coords = [(graph.nodes[node]['y'], graph.nodes[node]['x']) for node in shortest_path]

    return jsonify({'route': route_coords})

if __name__ == '__main__':
    app.run(debug=True)
