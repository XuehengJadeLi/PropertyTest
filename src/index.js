import "cesium/Build/Cesium/Widgets/widgets.css";
import "./css/main.css";
import "./css/controls.css";
import * as Cesium from "cesium";
import { accessToken, assetIds } from "./js/CesiumConfig";
import TileStyleManager from "./js/TileStyleManager";
import PropertyDataService from "./js/PropertyDataService";
import InfoPanel from "./js/InfoPanel";
import BuildingSelector from "./js/BuildingSelector";
import FloorGenerator from "./js/FloorGenerator";
import BuildingDataLoader from "./js/BuildingDataLoader";

// Add an error handler for uncaught exceptions
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Error in application:", message, error);
    document.body.innerHTML += `<div style="position:fixed; top:0; left:0; background:rgba(255,0,0,0.7); color:white; padding:10px; z-index:9999;">
        Error: ${message}<br>Line: ${lineno}<br>${error?.stack || ""}
    </div>`;
    return true;
};

// Initialize Cesium access
console.log("Using Cesium Ion token:", accessToken);
Cesium.Ion.defaultAccessToken = accessToken;

// Create clock settings
const clock = new Cesium.Clock({
    startTime: Cesium.JulianDate.fromDate(new Date()),
    currentTime: Cesium.JulianDate.fromDate(new Date()),
    stopTime: Cesium.JulianDate.addDays(Cesium.JulianDate.fromDate(new Date()), 1, new Cesium.JulianDate()),
    clockRange: Cesium.ClockRange.LOOP_STOP,
    clockStep: Cesium.ClockStep.SYSTEM_CLOCK,
    multiplier: 1,
    shouldAnimate: false
});

// Rotterdam coordinates
const ROTTERDAM_CENTER = {
    longitude: 4.47917,
    latitude: 51.9225,
    height: 2000
};

// Initialize the viewer with minimal options first
console.log("Creating Cesium viewer...");
let viewer;
try {
    viewer = new Cesium.Viewer('cesiumContainer', {
        clock: clock,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        scene3DOnly: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        selectionIndicator: false,
        infoBox: false
    });
    
    // Initialize terrain asynchronously
    console.log("Loading world terrain...");
    Cesium.createWorldTerrainAsync()
        .then(terrain => {
            viewer.terrainProvider = terrain;
            console.log("World terrain loaded successfully");
        })
        .catch(error => {
            console.error("Failed to load world terrain:", error);
        });
} catch (error) {
    console.error("Error creating Cesium viewer:", error);
    document.getElementById('cesiumContainer').innerHTML = 
        `<div style="color:white; background:rgba(0,0,0,0.7); padding:20px;">
            Error creating Cesium viewer: ${error.message}
        </div>`;
    throw error;
}

// Remove default imagery layer and add Cesium World Imagery
console.log("Loading world imagery...");
viewer.imageryLayers.removeAll();
Cesium.createWorldImageryAsync({
    style: Cesium.IonWorldImageryStyle.AERIAL
})
.then(imagery => {
    viewer.imageryLayers.addImageryProvider(imagery);
    console.log("World imagery loaded successfully");
})
.catch(error => {
    console.error("Failed to load world imagery:", error);
});

// Set initial camera position to Rotterdam
try {
    console.log("Setting camera to Rotterdam...");
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
            4.526804,
            51.948705,
            1000,
        ),
        orientation: {
            heading: Cesium.Math.toRadians(30),
            pitch: Cesium.Math.toRadians(-35),
            roll: 0
        }
    });
} catch (error) {
    console.error("Error setting camera position:", error);
}

// Initialize our custom components
console.log("Initializing custom components...");
const propertyDataService = new PropertyDataService();
const infoPanel = new InfoPanel();
const buildingDataLoader = new BuildingDataLoader();

// Path to building dataset
const BUILDING_DATASET_PATH = 'C:/Users/xuehe/PropertyValuation/BAGWOZ_DATASET.txt';

// Load Rotterdam CityGML models
console.log("Loading CityGML models with IDs:", assetIds.cityGml, assetIds.cityGml2);
console.log("Will load building IDs from:", BUILDING_DATASET_PATH);

// Create a loading indicator
const loadingIndicator = document.createElement('div');
loadingIndicator.style.position = 'fixed';
loadingIndicator.style.top = '50%';
loadingIndicator.style.left = '50%';
loadingIndicator.style.transform = 'translate(-50%, -50%)';
loadingIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
loadingIndicator.style.color = 'white';
loadingIndicator.style.padding = '20px';
loadingIndicator.style.borderRadius = '10px';
loadingIndicator.style.zIndex = '9999';
loadingIndicator.textContent = 'Loading building data...';
document.body.appendChild(loadingIndicator);

// Apply height offset to lift models above ground
const initialHeightOffset = 35; 
const southOffset = 3; 
const eastOffset = 28;

// The display offset makes the slider show 0 when the actual height offset is 35
const displayOffset = 35;

console.log(`Applying initial offsets: East=${eastOffset}m, South=${southOffset}m, Height=${initialHeightOffset}m`);
let currentHeightOffset = initialHeightOffset;
let tilesets = [];

// Function to update the height offset of all building models
function updateBuildingHeight(displayValue, sourceElement) {
    // Convert display value to actual height offset by adding the display offset
    const actualHeightOffset = displayValue + displayOffset;
    currentHeightOffset = actualHeightOffset;
    
    const translation = Cesium.Cartesian3.fromElements(eastOffset, southOffset, actualHeightOffset, new Cesium.Cartesian3());
    const modelMatrix = Cesium.Matrix4.fromTranslation(translation);
    
    // Apply to all tilesets
    tilesets.forEach(tileset => {
        if (tileset) {
            tileset.modelMatrix = modelMatrix;
        }
    });
    
    // Force a render to show the change
    viewer.scene.requestRender();
    
    // Get references to UI elements
    const heightInput = document.getElementById('heightOffsetInput');
    const heightSlider = document.getElementById('heightOffsetSlider');
    const valueIndicator = document.getElementById('heightValueIndicator');
    
    // Update UI elements that aren't the source of this update
    if (heightInput && sourceElement !== heightInput) {
        heightInput.value = displayValue;
    }
    
    if (heightSlider && sourceElement !== heightSlider) {
        heightSlider.value = displayValue;
    }
    
    if (valueIndicator) {
        valueIndicator.textContent = displayValue + 'm';
    }
}

// Add the footprint height control UI
function addFootprintHeightControl() {
    // Create the control container
    const controlContainer = document.createElement('div');
    controlContainer.className = 'footprint-height-control';
    
    // Create the label
    const label = document.createElement('label');
    label.textContent = 'Footprint height relative to surface';
    
    // Create slider and input row
    const controlRow = document.createElement('div');
    controlRow.className = 'control-row';
    
    // Create the slider - adjust min/max to accommodate the display offset and new range
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'heightOffsetSlider';
    slider.min = '-100';
    slider.max = '100';
    slider.step = '1';
    slider.value = 0;    // Display 0 when the actual height is initialHeightOffset
    
    // Create the text input - initially show 0
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'heightOffsetInput';
    input.min = '-100';
    input.max = '100';
    input.value = 0;
    
    // Create value indicator - initially show 0m
    const valueIndicator = document.createElement('span');
    valueIndicator.id = 'heightValueIndicator';
    valueIndicator.className = 'value-indicator';
    
    // Add event listeners for immediate, synchronous updates
    slider.addEventListener('input', () => {
        const value = parseInt(slider.value);
        updateBuildingHeight(value, slider);
    });
    
    input.addEventListener('input', () => {
        // Validate input within range
        let value = parseInt(input.value);
        if (isNaN(value)) value = 0;
        value = Math.max(-100, Math.min(100, value));
        
        // Update building height immediately
        updateBuildingHeight(value, input);
    });
    
    // Assemble the control
    controlRow.appendChild(slider);
    controlRow.appendChild(input);
    controlRow.appendChild(valueIndicator);
    controlContainer.appendChild(label);
    controlContainer.appendChild(controlRow);
    
    // Add the control to the document
    document.body.appendChild(controlContainer);
}

// Initialize with the default translation
const translation = Cesium.Cartesian3.fromElements(eastOffset, southOffset, currentHeightOffset, new Cesium.Cartesian3());
const modelMatrix = Cesium.Matrix4.fromTranslation(translation);

// Load tilesets and building dataset from BAGWOZ_DATASET.txt
Promise.all([
    Cesium.Cesium3DTileset.fromIonAssetId(assetIds.cityGml).catch(error => {
        console.error("Error loading first CityGML tileset:", error);
        return null;
    }),
    Cesium.Cesium3DTileset.fromIonAssetId(assetIds.cityGml2).catch(error => {
        console.error("Error loading second CityGML tileset:", error);
        return null;
    }),
    // Load building IDs from the text file
    buildingDataLoader.loadBuildingIdsFromFile(BUILDING_DATASET_PATH)
])
.then(([tileset1, tileset2, buildingIdsLoaded]) => {
    // Remove loading indicator
    if (document.body.contains(loadingIndicator)) {
        loadingIndicator.remove();
    }
    
    if (!tileset1 && !tileset2) {
        console.error("Failed to load both tilesets");
        return;
    }
    
    console.log("CityGML models loaded:", tileset1 ? "Tileset 1 OK" : "Tileset 1 failed", 
                                         tileset2 ? "Tileset 2 OK" : "Tileset 2 failed");
    console.log("Building IDs loaded from BAGWOZ_DATASET.txt:", buildingIdsLoaded ? "Yes" : "No");
    
    // Store tilesets in the global array
    tilesets = [tileset1, tileset2].filter(tileset => tileset !== null);
    
    // Add the footprint height control after tilesets are loaded
    addFootprintHeightControl();
    
    // Initialize style manager
    console.log("Initializing style manager...");
    const primaryTileset = tilesets.length > 0 ? tilesets[0] : null;
    const secondaryTileset = tilesets.length > 1 ? tilesets[1] : null;
    const styleManager = new TileStyleManager(primaryTileset, secondaryTileset);
    
    // Set the building data loader
    styleManager.setBuildingDataLoader(buildingDataLoader);

    // Add error handling for tileset processing
    try {
        if (tileset1) {
            tileset1.modelMatrix = modelMatrix;
            viewer.scene.primitives.add(tileset1);
            
            // Handle tile load errors more gracefully
            tileset1.tileLoad.addEventListener((tile) => {
                if (tile.contentError) {
                    console.log("Tile content error handled gracefully:", tile.contentError);
                }
            });
        }
        
        if (tileset2) {
            tileset2.modelMatrix = modelMatrix;
            viewer.scene.primitives.add(tileset2);
            
            // Handle tile load errors more gracefully
            tileset2.tileLoad.addEventListener((tile) => {
                if (tile.contentError) {
                    console.log("Tile content error handled gracefully:", tile.contentError);
                }
            });
        }
        
        // Initialize building selector with floor visualization capabilities
        console.log("Initializing building selector...");
        const buildingSelector = new BuildingSelector(viewer, propertyDataService, infoPanel, styleManager);
        
        // Wait a moment to ensure tilesets are loaded
        setTimeout(() => {
            // Apply the building filter style to color buildings gray if not in BAGWOZ_DATASET.txt
            console.log("Applying dataset-based coloring...");
            
            // Regardless of the boolean returned, rely on the loader's internal `loaded` flag.
            // The style manager will gracefully handle cases where data is still not ready.
            const buildingIds = buildingDataLoader.getAllBuildingIds();
            console.log(`Applying color styling based on ${buildingIds.size} building IDs`);
            styleManager.applyBuildingFilter();
            
            // Force a render to show the new styling
            viewer.scene.requestRender();
        }, 1000);
        
        // Enable lighting
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Add a helper button for floor visualization
        addFloorVisualizationButton(viewer);
        
        // Force a render
        console.log("Forcing initial render...");
        viewer.scene.requestRender();
    } catch (error) {
        console.error("Error configuring tilesets:", error);
    }
}).catch(error => {
    // Remove loading indicator
    if (document.body.contains(loadingIndicator)) {
        loadingIndicator.remove();
    }
    
    console.error('Error in CityGML loading process:', error);
    document.body.innerHTML += `<div style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(255,0,0,0.7); color:white; padding:20px; z-index:9999;">
        Error loading data: ${error.message}
    </div>`;
});

/**
 * Adds a helper button in the bottom-right corner to toggle floor visualization
 * @param {Cesium.Viewer} viewer - The Cesium viewer
 */
function addFloorVisualizationButton(viewer) {
    // Create the button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'cesium-viewer-toolbar';
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.bottom = '30px';
    buttonContainer.style.right = '30px';
    buttonContainer.style.zIndex = '1000';
    
    // Create the button
    const button = document.createElement('button');
    button.className = 'cesium-button cesium-toolbar-button';
    button.id = 'floorModeButton';
    button.innerHTML = '<span style="font-size:16px">🏢</span> Floor Mode';
    button.title = 'Toggle Floor Visualization Mode';
    button.style.padding = '8px 12px';
    button.style.fontSize = '14px';
    button.style.backgroundColor = '#1e4877';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    button.style.cursor = 'pointer';
    
    let floorModeActive = false;
    
    // Add button click event
    button.addEventListener('click', () => {
        floorModeActive = !floorModeActive;
        
        if (floorModeActive) {
            button.style.backgroundColor = '#2e70ff';
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4)';
            
            // Show instructions overlay
            showInstructions();
            
            // Enable debug mode in CesiumJS
            viewer.scene.debugShowBoundingVolume = true;
            viewer.scene.debugShowFrustumPlanes = true;
        } else {
            button.style.backgroundColor = '#1e4877';
            button.style.transform = '';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            
            // Hide instructions
            const instructions = document.getElementById('floorInstructions');
            if (instructions) instructions.remove();
            
            // Disable debug mode in CesiumJS
            viewer.scene.debugShowBoundingVolume = false;
            viewer.scene.debugShowFrustumPlanes = false;
            
            // Hide all floor visualizations
            const floorGenerator = new FloorGenerator(viewer);
            floorGenerator.removeAllFloorModels();
            
            // Clean up any indicators
            if (document.getElementById('floorDebugIndicator')) {
                document.getElementById('floorDebugIndicator').remove();
            }
            
            if (document.getElementById('floorGenerationError')) {
                document.getElementById('floorGenerationError').remove();
            }
        }
    });
    
    // Add the button to the container
    buttonContainer.appendChild(button);
    
    // Add the container to the document
    document.body.appendChild(buttonContainer);
    
    /**
     * Show floor visualization instructions
     */
    function showInstructions() {
        // Create instructions overlay
        const instructions = document.createElement('div');
        instructions.id = 'floorInstructions';
        instructions.style.position = 'absolute';
        instructions.style.top = '50%';
        instructions.style.left = '50%';
        instructions.style.transform = 'translate(-50%, -50%)';
        instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        instructions.style.color = 'white';
        instructions.style.padding = '25px';
        instructions.style.borderRadius = '8px';
        instructions.style.zIndex = '2000';
        instructions.style.maxWidth = '450px';
        instructions.style.textAlign = 'center';
        instructions.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        instructions.innerHTML = `
            <h3 style="margin-top:0;font-size:18px;color:#2e70ff;">Floor Visualization Mode</h3>
            <p>Follow these steps to view building floors:</p>
            <ol style="text-align:left;padding-left:20px;">
                <li>Click on any building to select it</li>
                <li>In the info panel that appears, click "Show Floors"</li>
                <li>Floor models will appear with different colors for each level</li>
                <li>You can click on individual floors for more information</li>
            </ol>
            <p style="margin-top:15px;font-style:italic;color:#aaa;">Floors are colored from ground (red) to top (blue)</p>
            <button id="closeInstructions" style="padding:8px 16px;margin-top:15px;cursor:pointer;background:#2e70ff;color:white;border:none;border-radius:4px;">Got it!</button>
        `;
        document.body.appendChild(instructions);
        
        document.getElementById('closeInstructions').addEventListener('click', () => {
            instructions.remove();
        });
        
        // Automatically remove after 12 seconds
        setTimeout(() => {
            if (document.getElementById('floorInstructions')) {
                document.getElementById('floorInstructions').remove();
            }
        }, 12000);
    }
}

// Cleanup
window.onbeforeunload = () => {
    if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
    }
};