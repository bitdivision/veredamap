# /// script
# dependencies = [
#   "requests",
#   "tqdm",
# ]
# ///
import requests
import json
import time
import os
from tqdm import tqdm
import argparse

def fetch_veredas(batch_size=10, total_records=32000, output_file="colombia_veredas.geojson", resume_from=None):
    """
    Fetch all vereda data from the ESRI service and save as GeoJSON.

    Args:
        batch_size: Number of records to fetch per request
        total_records: Approximate total number of records
        output_file: Path to save the final GeoJSON file
        resume_from: Offset to resume from (if None, starts from beginning)
    """
    url = "https://ags.esri.co/arcgis/rest/services/DatosAbiertos/VEREDAS_2016/MapServer/0/query"

    headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en;q=0.6',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://datosabiertos.esri.co',
        'Referer': 'https://datosabiertos.esri.co/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }

    # Initialize a GeoJSON structure or load existing data if resuming
    if resume_from is not None:
        print(f"Attempting to resume from offset {resume_from}")
        if os.path.exists(f"{output_file}.partial"):
            print(f"Resuming from offset {resume_from} using partial file")
            with open(f"{output_file}.partial", 'r') as f:
                geojson = json.load(f)
        elif os.path.exists(output_file):
            print(f"Partial file not found, but output file exists. Loading {output_file} and resuming from {resume_from}")
            with open(output_file, 'r') as f:
                geojson = json.load(f)
        else:
            print(f"No existing files found. Starting new collection from offset {resume_from}")
            geojson = {
                "type": "FeatureCollection",
                "features": []
            }
        start_offset = resume_from
    else:
        geojson = {
            "type": "FeatureCollection",
            "features": []
        }
        start_offset = 0

    # Calculate number of batches needed
    remaining_records = total_records - start_offset
    num_batches = (remaining_records + batch_size - 1) // batch_size

    print(f"Fetching approximately {remaining_records} veredas in {num_batches} batches starting from offset {start_offset}...")

    # Fetch data in batches
    for offset in tqdm(range(start_offset, total_records, batch_size)):
        params = {
            'f': 'json',
            'where': '1=1',
            'outFields': '*',
            'returnGeometry': 'true',
            'resultOffset': offset,
            'resultRecordCount': batch_size
        }

        # Try the request with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Requesting offset={offset}, count={batch_size}")
                response = requests.post(url, headers=headers, data=params)
                response.raise_for_status()
                data = response.json()

                # Debug information
                feature_count = len(data.get('features', []))
                print(f"Received {feature_count} features for offset {offset}")

                if feature_count == 0:
                    print(f"Response details: {json.dumps(data, indent=2)[:500]}...")

                break
            except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
                if attempt < max_retries - 1:
                    wait_time = 10 * (attempt + 1)  # Exponential backoff
                    print(f"Error: {e}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    print(f"Failed after {max_retries} attempts: {e}")
                    raise

        # Check if we got features
        if 'features' not in data or not data['features']:
            print(f"No more features found after offset {offset}")
            # Save the current state before exiting
            with open(output_file, 'w') as f:
                json.dump(geojson, f)
            print(f"Saved {len(geojson['features'])} features to {output_file}")
            break

        # Convert ESRI JSON features to GeoJSON features
        for esri_feature in data['features']:
            geojson_feature = {
                "type": "Feature",
                "properties": esri_feature['attributes'],
                "geometry": {
                    "type": "Polygon",
                    "coordinates": []
                }
            }

            # Convert ESRI rings to GeoJSON coordinates
            if 'geometry' in esri_feature and 'rings' in esri_feature['geometry']:
                geojson_feature["geometry"]["coordinates"] = esri_feature['geometry']['rings']

            geojson["features"].append(geojson_feature)

        # Be nice to the server - pause between requests
        time.sleep(2)  # 2 second delay between requests

    # Save the final GeoJSON file
    with open(output_file, 'w') as f:
        json.dump(geojson, f)

    print(f"Completed! Saved {len(geojson['features'])} veredas to {output_file}")

    # Remove partial file if it exists
    if os.path.exists(f"{output_file}.partial"):
        os.remove(f"{output_file}.partial")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Colombia veredas data")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of records per request")
    parser.add_argument("--total-records", type=int, default=32000, help="Approximate total number of records")
    parser.add_argument("--output-file", default="colombia_veredas.geojson", help="Output file path")
    parser.add_argument("--resume-from", type=int, help="Offset to resume from")

    args = parser.parse_args()

    # Debug the arguments
    print(f"Arguments received: {args}")

    fetch_veredas(
        batch_size=args.batch_size,
        total_records=args.total_records,
        output_file=args.output_file,
        resume_from=args.resume_from
    )