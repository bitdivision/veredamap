# Vereda Map
This is a basic map showing the veredas of Colombia. A vereda is the smallest administrative unit in Colombia.

Annoyingly, google maps does not seem to have data for veredas and often searching for veredas will return no results.

So this map is meant to be a quick reference if you're looking for a particular vereda.

## Data
Data is from [Esri Colombia](https://datosabiertos.esri.co/datasets/veredas-de-colombia/explore?showTable=true). Unfortunately, the data downloads were not working so I had to batch download via the API.

Data was downloaded on 2025-02-26, and it may include errors.

## Processing
tippecanoe -o veredas_simplified.mbtiles -z12 --coalesce --extend-zooms-if-still-dropping veredas.geojson
pmtiles convert veredas_simplified.mbtiles veredas_simplified.pmtiles

## Testing
- Run `http-server`
- Go to http://localhost

## Code
Code is entirely written by Anthropic Claude. Don't judge it.

Wanted to host everything on github pages, so had to keep the pmtiles under 100MB.
