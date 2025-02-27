import json
import sys
from statistics import mean

def process_geojson(input_file, output_file):
    print(f"Processing {input_file}...")

    # Load the GeoJSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)

    # Initialize the output list
    veredas_index = []

    # Process each feature
    for feature in geojson_data.get('features', []):
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})

        # Extract the relevant attributes
        vereda_name = properties.get('NOMBRE_VER', '')
        department = properties.get('NOM_DEP', '')
        municipality = properties.get('NOMB_MPIO', '')

        # Skip if missing essential data
        if not vereda_name or not department:
            continue

        # Calculate the centroid of the polygon for search results positioning
        if geometry.get('type') == 'Polygon':
            coordinates = geometry.get('coordinates', [[]])
            if coordinates and coordinates[0]:
                # Extract all coordinates from the first ring
                coords = coordinates[0]

                # Calculate the centroid (average of all coordinates)
                lon_values = [coord[0] for coord in coords]
                lat_values = [coord[1] for coord in coords]

                lon = mean(lon_values)
                lat = mean(lat_values)

                # Create the vereda entry
                vereda_entry = {
                    "vereda": vereda_name,
                    "department": department,
                    "municipality": municipality,
                    "lon": lon,
                    "lat": lat,
                    "code": properties.get('CODIGO_VER', '')
                }

                veredas_index.append(vereda_entry)

    # Sort by vereda name for better search experience
    veredas_index.sort(key=lambda x: x['vereda'])

    # Write the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(veredas_index, f, ensure_ascii=False, indent=2)

    print(f"Successfully processed {len(veredas_index)} veredas")
    print(f"Output written to {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_search_index.py input.geojson output.json")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    process_geojson(input_file, output_file)