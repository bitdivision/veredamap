// Configuration constants that might need tweaking
const CONFIG = {
  // Map settings
  initialCenter: [-74.0, 4.7], // Center on Colombia (Bogotá)
  initialZoom: 6,

  // Layer styling
  veredaBorderColor: 'rgba(0, 0, 255, 0.5)',
  veredaBorderWidth: 0.8,
  highlightBorderColor: 'rgba(255, 0, 0, 1)',
  highlightBorderWidth: 3,
  highlightFillColor: 'rgba(255, 0, 0, 0.3)',

  // Text labels
  labelZoomThreshold: 13, // Show vereda labels above this zoom
  labelFont: 'bold 12px Arial, sans-serif',
  labelTextColor: '#000000',
  labelStrokeColor: '#FFFFFF',
  labelStrokeWidth: 3,

  // Hover and popup behavior
  hoverZoomThreshold: 10, // Enable hover popups above this zoom
  hoverPopupDelay: 400, // ms delay before showing hover popup

  // Satellite imagery
  satelliteMaxZoom: 17,
  satelliteOverZoomThreshold: 19 // Show warning above this zoom
};

// Set up the map to use geographic coordinates
ol.proj.useGeographic();

// Create the vector layer for Colombia Veredas with text styling for high zoom levels
const veredasLayer = new ol.layer.VectorTile({
  declutter: true,
  source: new olpmtiles.PMTilesVectorSource({
    url: './veredas_simplified.pmtiles',
    attributions: ["© Esri Colombia"]
  }),
  style: function(feature, resolution) {
    // Get the current zoom level
    const zoom = map ? map.getView().getZoom() : 0;

    // Base style for the vereda boundaries
    const baseStyle = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: CONFIG.veredaBorderColor,
        width: CONFIG.veredaBorderWidth,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)',
      }),
    });

    // Only add text labels at high zoom levels
    if (zoom > CONFIG.labelZoomThreshold) {
      const veredaName = feature.get('NOMBRE_VER');

      if (veredaName) {
        // Create text style for the vereda name
        const textStyle = new ol.style.Style({
          text: new ol.style.Text({
            text: veredaName,
            font: CONFIG.labelFont,
            fill: new ol.style.Fill({
              color: CONFIG.labelTextColor
            }),
            stroke: new ol.style.Stroke({
              color: CONFIG.labelStrokeColor,
              width: CONFIG.labelStrokeWidth
            }),
            overflow: true,
            placement: 'point',
            maxAngle: 45,
            offsetY: 0
          }),
          zIndex: 2
        });

        // Return both styles (boundary and text)
        return [baseStyle, textStyle];
      }
    }

    // Return only the base style if not showing text
    return baseStyle;
  }
});

// Create a popup overlay
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new ol.Overlay({
  element: container,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

// Add a click handler to hide the popup
closer.onclick = function() {
  overlay.setPosition(undefined);
  closer.blur();
  isPopupFromClick = false;
  return false;
};

// Create the map with multiple base layers
const osmLayer = new ol.layer.Tile({
  source: new ol.source.OSM(),
  title: 'OpenStreetMap',
  type: 'base',
  visible: true
});

// Modified satellite layer with maxZoom and better error handling
const satelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributions: ['Esri, Maxar, Earthstar Geographics, and the GIS User Community'],
    maxZoom: CONFIG.satelliteMaxZoom,
    // Use lower resolution tiles when zoomed beyond maxZoom
    tileLoadFunction: function(imageTile, src) {
      const tileCoord = imageTile.getTileCoord();
      let z = tileCoord[0];
      const originalZ = z;

      // If requested zoom is beyond maxZoom, adjust the URL to use the maxZoom tiles
      if (z > CONFIG.satelliteOverZoomThreshold) {
        const x = tileCoord[1];
        const y = tileCoord[2];

        // Calculate the equivalent tile coordinates at maxZoom
        const factor = Math.pow(2, z - CONFIG.satelliteOverZoomThreshold);
        const adjustedX = Math.floor(x / factor);
        const adjustedY = Math.floor(y / factor);

        // Modify the source URL to request the lower zoom tile
        src = src.replace(`/${z}/${y}/${x}`, `/${CONFIG.satelliteOverZoomThreshold}/${adjustedY}/${adjustedX}`);
      }

      // Load the image
      const img = imageTile.getImage();
      img.src = src;

      // Add a class to indicate this is a lower resolution tile if needed
      if (originalZ > CONFIG.satelliteOverZoomThreshold) {
        img.classList.add('lower-resolution-tile');
      }
    }
  }),
  title: 'Satellite',
  type: 'base',
  visible: false
});

// Create the map
const map = new ol.Map({
  target: 'map',
  overlays: [overlay],
  layers: [
    // Base layers group
    new ol.layer.Group({
      title: 'Base Maps',
      layers: [osmLayer, satelliteLayer]
    }),
    // Data layers
    veredasLayer
  ],
  view: new ol.View({
    center: CONFIG.initialCenter,
    zoom: CONFIG.initialZoom,
  }),
});

// Add layer switcher control to the map
const layerSwitcher = document.createElement('div');
layerSwitcher.className = 'layer-switcher';
layerSwitcher.innerHTML = `
  <div class="layer-switcher-inner">
    <div class="layer-option">
      <input type="radio" id="osm-layer" name="base-layer" value="osm" checked>
      <label for="osm-layer">Map</label>
    </div>
    <div class="layer-option">
      <input type="radio" id="satellite-layer" name="base-layer" value="satellite">
      <label for="satellite-layer">Satellite</label>
    </div>
  </div>
`;

document.body.appendChild(layerSwitcher);

// Add event listeners for layer switching
document.getElementById('osm-layer').addEventListener('change', function() {
  osmLayer.setVisible(true);
  satelliteLayer.setVisible(false);
});

document.getElementById('satellite-layer').addEventListener('change', function() {
  osmLayer.setVisible(false);
  satelliteLayer.setVisible(true);
});

// Store for vereda data
let veredasData = [];
let isDataLoaded = false;

// Add a variable to store the currently highlighted feature
let highlightedFeature = null;

// Create a style for highlighted features
const highlightStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: CONFIG.highlightBorderColor,
    width: CONFIG.highlightBorderWidth,
  }),
  fill: new ol.style.Fill({
    color: CONFIG.highlightFillColor,
  }),
});

// Function to highlight a feature by its properties
function highlightFeatureByProperties(veredaName, municipalityName, departmentName) {
  // Clear any existing highlight
  highlightedFeature = null;

  // Create a function to check if a feature matches the search result
  const matchesSearchResult = function(feature) {
    const props = feature.getProperties();
    return props.NOMBRE_VER === veredaName &&
           props.NOMB_MPIO === municipalityName &&
           props.NOM_DEP === departmentName;
  };

  // Set up a style function for the veredas layer
  veredasLayer.setStyle(function(feature) {
    // Get the current zoom level
    const zoom = map ? map.getView().getZoom() : 0;

    if (matchesSearchResult(feature)) {
      highlightedFeature = feature;
      return highlightStyle;
    } else {
      // Base style for the vereda boundaries (same as original)
      const baseStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: CONFIG.veredaBorderColor,
          width: CONFIG.veredaBorderWidth,
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255, 255, 255, 0)',
        }),
      });

      // Only add text labels at high zoom levels (same as original)
      if (zoom > CONFIG.labelZoomThreshold) {
        const veredaName = feature.get('NOMBRE_VER');

        if (veredaName) {
          // Create text style for the vereda name
          const textStyle = new ol.style.Style({
            text: new ol.style.Text({
              text: veredaName,
              font: CONFIG.labelFont,
              fill: new ol.style.Fill({
                color: CONFIG.labelTextColor
              }),
              stroke: new ol.style.Stroke({
                color: CONFIG.labelStrokeColor,
                width: CONFIG.labelStrokeWidth
              }),
              overflow: true,
              placement: 'point',
              maxAngle: 45,
              offsetY: 0
            }),
            zIndex: 2
          });

          // Return both styles (boundary and text)
          return [baseStyle, textStyle];
        }
      }

      // Return only the base style if not showing text
      return baseStyle;
    }
  });
}

// Function to load vereda data for search
async function loadVeredasData() {
  try {
    // Updated to use relative path instead of window.location.origin
    const response = await fetch('./search_index.json');
    veredasData = await response.json();
    isDataLoaded = true;

    // Only initialize search if the search elements exist
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      initializeSearch();

      // Move the search container to the right to avoid covering map elements
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.style.left = '50px'; // Move right from 10px to 50px
      }
    }
  } catch (error) {
    console.error('Error loading veredas data:', error);
  }
}

// Initialize search functionality
function initializeSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  // Check if elements exist before adding event listeners
  if (!searchInput || !searchResults) {
    console.warn('Search elements not found in the DOM');
    return;
  }

  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();

    // Clear results if query is empty
    if (query === '') {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }

    // Filter veredas based on query
    const filteredResults = veredasData
      .filter(item =>
        item.vereda.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query))
      .slice(0, 10); // Limit to 10 results

    // Display results
    if (filteredResults.length > 0) {
      searchResults.innerHTML = '';
      filteredResults.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `<strong>${result.vereda}</strong>, ${result.department}`;

        // Add click handler to zoom to location and highlight the feature
        resultItem.addEventListener('click', function() {
          // Zoom to the vereda with a higher zoom level
          map.getView().animate({
            center: [result.lon, result.lat],
            zoom: 12,
            duration: 1000
          });

          // Highlight the feature
          highlightFeatureByProperties(result.vereda, result.municipality, result.department);

          // Clear search
          searchInput.value = '';
          searchResults.style.display = 'none';
        });

        searchResults.appendChild(resultItem);
      });
      searchResults.style.display = 'block';
    } else {
      searchResults.innerHTML = '<div class="no-results">No results found</div>';
      searchResults.style.display = 'block';
    }
  });

  // Hide results when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}

// Add hover interaction to show vereda information using the existing popup
let hoverFeature = null;
let isPopupFromClick = false; // Flag to track if popup is from click or hover
let hoverTimer = null; // Timer for delayed hover popup

map.on('pointermove', function(e) {
  // Get current zoom level
  const zoom = map.getView().getZoom();

  // Don't show hover popup if zoom level is too low
  if (zoom < CONFIG.hoverZoomThreshold) {
    map.getViewport().style.cursor = '';
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (!isPopupFromClick) {
      overlay.setPosition(undefined);
    }
    return;
  }

  // Don't show hover popup if the popup is currently displayed from a click
  if (isPopupFromClick) {
    return;
  }

  const pixel = map.getEventPixel(e.originalEvent);
  const hit = map.hasFeatureAtPixel(pixel);

  // Change cursor style
  map.getViewport().style.cursor = hit ? 'pointer' : '';

  // Clear any existing hover timer
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  // Handle hover popup with delay
  if (hit) {
    const feature = map.forEachFeatureAtPixel(pixel, function(feature) {
      return feature;
    });

    if (feature) {
      // Set a timer to show the popup after delay
      hoverTimer = setTimeout(function() {
        hoverFeature = feature;
        const properties = feature.getProperties();

        // Create popup content
        let htmlContent = '<div style="padding: 5px;">';

        const dept = properties.NOM_DEP;
        const muni = properties.NOMB_MPIO;
        const vereda = properties.NOMBRE_VER;

        if (dept) {
          htmlContent += `<p><strong>Department:</strong> ${dept}</p>`;
        }

        if (muni) {
          htmlContent += `<p><strong>Municipality:</strong> ${muni}</p>`;
        }

        if (vereda) {
          htmlContent += `<p><strong>Vereda:</strong> ${vereda}</p>`;
        }

        htmlContent += '</div>';
        content.innerHTML = htmlContent;
        overlay.setPosition(e.coordinate);
      }, CONFIG.hoverPopupDelay);
    }
  } else {
    // Only hide the popup if it's not from a click
    if (!isPopupFromClick) {
      hoverFeature = null;
      overlay.setPosition(undefined);
    }
  }
});

// Hide hover popup when map is moved
map.on('movestart', function() {
  // Clear any existing hover timer
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  // Only hide the popup if it's not from a click
  if (!isPopupFromClick) {
    overlay.setPosition(undefined);
  }
});

// Modify the click handler to set the isPopupFromClick flag
map.on('click', function(evt) {
  // Always reset any existing highlight first
  highlightedFeature = null;

  // Reset to original style function
  veredasLayer.setStyle(function(feature, resolution) {
    // Get the current zoom level
    const zoom = map ? map.getView().getZoom() : 0;

    // Base style for the vereda boundaries
    const baseStyle = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: CONFIG.veredaBorderColor,
        width: CONFIG.veredaBorderWidth,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)',
      }),
    });

    // Only add text labels at high zoom levels
    if (zoom > CONFIG.labelZoomThreshold) {
      const veredaName = feature.get('NOMBRE_VER');

      if (veredaName) {
        // Create text style for the vereda name
        const textStyle = new ol.style.Style({
          text: new ol.style.Text({
            text: veredaName,
            font: CONFIG.labelFont,
            fill: new ol.style.Fill({
              color: CONFIG.labelTextColor
            }),
            stroke: new ol.style.Stroke({
              color: CONFIG.labelStrokeColor,
              width: CONFIG.labelStrokeWidth
            }),
            overflow: true,
            placement: 'point',
            maxAngle: 45,
            offsetY: 0
          }),
          zIndex: 2
        });

        // Return both styles (boundary and text)
        return [baseStyle, textStyle];
      }
    }

    // Return only the base style if not showing text
    return baseStyle;
  });

  const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    return feature;
  });

  if (feature) {
    const properties = feature.getProperties();

    let htmlContent = '<div style="padding: 5px;">';

    // Use the correct property names from your data
    const dept = properties.NOM_DEP;
    const muni = properties.NOMB_MPIO;
    const vereda = properties.NOMBRE_VER;

    if (dept) {
      htmlContent += `<p><strong>Department:</strong> ${dept}</p>`;
    }

    if (muni) {
      htmlContent += `<p><strong>Municipality:</strong> ${muni}</p>`;
    }

    if (vereda) {
      htmlContent += `<p><strong>Vereda:</strong> ${vereda}</p>`;
    }

    // If none of these specific properties are found, show a message
    if (!dept && !muni && !vereda) {
      htmlContent += '<p>No information available for this feature.</p>';
    }

    htmlContent += '</div>';
    content.innerHTML = htmlContent;
    overlay.setPosition(evt.coordinate);

    // Set the flag to indicate the popup is from a click
    isPopupFromClick = true;
  } else {
    overlay.setPosition(undefined);
    closer.blur();

    // Reset the flag
    isPopupFromClick = false;
  }
});

// Load vereda data for search
loadVeredasData();

// Add a view change handler to show/hide the warning
map.getView().on('change:resolution', function() {
  // This will trigger a redraw of the layer with updated styles
  veredasLayer.changed();

  // Also update the zoom warning
  updateZoomWarning();
});

// Add a listener for layer visibility changes
satelliteLayer.on('change:visible', function() {
  updateZoomWarning();
});

// Function to update the zoom warning
function updateZoomWarning() {
  const zoom = map.getView().getZoom();
  const warningElement = document.getElementById('zoom-warning');

  if (zoom > CONFIG.satelliteOverZoomThreshold && satelliteLayer.getVisible()) {
    if (!warningElement) {
      const warning = document.createElement('div');
      warning.id = 'zoom-warning';
      warning.innerHTML = 'Using lower resolution imagery at this zoom level';
      warning.style.position = 'absolute';
      warning.style.bottom = '10px';
      warning.style.left = '50%';
      warning.style.transform = 'translateX(-50%)';
      warning.style.backgroundColor = 'rgba(0,0,0,0.7)';
      warning.style.color = 'white';
      warning.style.padding = '8px 12px';
      warning.style.borderRadius = '4px';
      warning.style.zIndex = '1000';
      document.body.appendChild(warning);
    }
  } else if (warningElement) {
    warningElement.remove();
  }
}
