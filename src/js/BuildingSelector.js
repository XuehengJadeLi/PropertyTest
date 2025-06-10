import * as Cesium from 'cesium';
import FloorGenerator from './FloorGenerator';

/**
 * BuildingSelector class to handle building selection in Cesium
 */
export default class BuildingSelector {
    /**
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance
     * @param {PropertyDataService} dataService - The property data service
     * @param {InfoPanel} infoPanel - The info panel to display building data
     * @param {TileStyleManager} styleManager - Optional style manager for building visualization
     */
    constructor(viewer, dataService, infoPanel, styleManager = null) {
        this.viewer = viewer;
        this.dataService = dataService;
        this.infoPanel = infoPanel;
        this.styleManager = styleManager;
        this.selectedEntity = null;
        this.featureMap = new Map(); // Map 3D Tiles feature IDs to PANDIDs
        this.selectedFeature = null;
        this.currentBuildingId = null;
        this.buildingsWithInfo = new Set(); // Track buildings that have information
        
        // Floor model generation
        this.floorGenerator = new FloorGenerator(viewer);
        this.showFloorsForSelectedBuilding = false;
        
        // Common PANDIDs from the dataset for testing
        this.knownPandIds = [
            '0599100000668111', // The ID shown in the screenshot
            '0599100000035588'  // Previous mock ID
        ];
        
        this.init();
    }
    
    /**
     * Initialize the building selector
     */
    init() {
        // Set up the handler for picking features
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        
        // Handle left click for building selection
        this.handler.setInputAction(this.onLeftClick.bind(this), Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // Load the mapping from feature IDs to PANDIDs (if available)
        this.loadFeatureMapping();
    }
    
    /**
     * Set the style manager after initialization
     * @param {TileStyleManager} styleManager - The style manager
     */
    setStyleManager(styleManager) {
        this.styleManager = styleManager;
        
        // Sync buildings with info if any are already tracked
        if (this.buildingsWithInfo.size > 0 && this.styleManager) {
            for (const buildingId of this.buildingsWithInfo) {
                this.styleManager.markBuildingHasInfo(buildingId);
            }
        }
    }
    
    /**
     * Load the mapping between feature IDs and PANDIDs
     * This could be loaded from a server or built manually
     */
    async loadFeatureMapping() {
        try {
            // Get all available PANDIDs from the database
            const pandIds = await this.dataService.getAllPandIds();
            console.log(`Loaded ${pandIds.length} PANDIDs from database`);
            
            if (pandIds.length > 0) {
                // Store the first few PANDIDs for testing purposes
                this.knownPandIds = pandIds.slice(0, 10);
                console.log('Sample PANDIDs from database:', this.knownPandIds);
                
                // If we have a style manager, forward the info so it can be used later (e.g., tooltips),
                // but do NOT overwrite the dataset-based coloring that was already applied.
                if (this.styleManager) {
                    // Refresh the cached set inside the style manager but skip re-styling.
                    this.styleManager.buildingsWithInfo = new Set();
                    for (const pandId of pandIds) {
                        this.styleManager.markBuildingHasInfo(pandId);
                    }
                    // NOTE: We intentionally avoid calling `applyNoInfoBuildingStyle()` here to preserve
                    // the white/gray initialization based solely on the residential-building dataset.
                }
            }
        } catch (error) {
            console.error('Error loading feature mapping:', error);
        }
    }
    
    /**
     * Update the list of buildings that have information
     * @param {Array<string>} pandIds - List of building IDs that have information
     */
    async updateBuildingsWithInfo(pandIds) {
        // First update our internal tracking
        this.buildingsWithInfo = new Set(pandIds);
        console.log(`Updated buildings with info: ${this.buildingsWithInfo.size} buildings`);
        
        // If we have a style manager, forward the info so it can be used later (e.g., tooltips),
        // but do NOT overwrite the dataset-based coloring that was already applied.
        if (this.styleManager) {
            // Refresh the cached set inside the style manager but skip re-styling.
            this.styleManager.buildingsWithInfo = new Set();
            for (const pandId of pandIds) {
                this.styleManager.markBuildingHasInfo(pandId);
            }
            // NOTE: We intentionally avoid calling `applyNoInfoBuildingStyle()` here to preserve
            // the white/gray initialization based solely on the residential-building dataset.
        }
    }
    
    /**
     * Mark a building as having information
     * @param {string} buildingId - The building ID
     */
    markBuildingHasInfo(buildingId) {
        if (!buildingId) return;
        
        // Add to our internal tracking
        this.buildingsWithInfo.add(buildingId);
        
        // If we have a style manager, update it as well
        if (this.styleManager) {
            this.styleManager.markBuildingHasInfo(buildingId);
        }
    }
    
    /**
     * Check if a building has information
     * @param {string} buildingId - The building ID
     * @returns {boolean} - True if the building has information
     */
    hasBuildingInfo(buildingId) {
        return this.buildingsWithInfo.has(buildingId);
    }
    
    /**
     * Handle left click event
     * @param {Cesium.ScreenSpaceEventHandler.MotionEvent} click - The click event
     */
    onLeftClick(click) {
        // Pick the feature at the clicked position
        const pickedFeature = this.viewer.scene.pick(click.position);
        
        // Clear previous selection if any
        this.clearSelection();
        
        if (Cesium.defined(pickedFeature) && 
            pickedFeature instanceof Cesium.Cesium3DTileFeature) {
            // Highlight the selected feature
            this.selectFeature(pickedFeature);
            
            // Try to get the building ID from the feature
            this.getFeatureBuildingId(pickedFeature)
                .then(pandId => {
                    if (pandId) {
                        console.log(`Fetching data for PANDID: ${pandId}`);
                        this.currentBuildingId = pandId;
                        
                        // Always try to fetch data for the building
                        return this.dataService.getPropertiesByPandId(pandId);
                    } else {
                        throw new Error('Could not determine PANDID for this building');
                    }
                })
                .then(properties => {
                    // Display the properties in the info panel if properties exist and are not empty
                    console.log(`Found ${properties ? properties.length : 0} properties for building`);
                    
                    if (properties && properties.length > 0) {
                        // Mark this building as having information
                        if (this.currentBuildingId) {
                            this.markBuildingHasInfo(this.currentBuildingId);
                        }
                        
                        // Display properties in the info panel
                        this.infoPanel.displayProperties(properties);
                        
                        // If floor generation is enabled, create floor models
                        if (this.showFloorsForSelectedBuilding) {
                            this.generateFloors(properties);
                        }
                        
                        // Add button to toggle floor models
                        this.infoPanel.addFloorToggleButton(
                            this.showFloorsForSelectedBuilding,
                            this.toggleFloorModels.bind(this)
                        );
                    } else {
                        // If no properties were found, show a message in the info panel
                        console.log('No properties found for this building');
                        this.infoPanel.showError(`No property data available for Building ID: ${this.currentBuildingId}`);
                    }
                })
                .catch(error => {
                    console.error('Error getting building data:', error);
                    this.infoPanel.showError('Error retrieving building data'); // Show error in the info panel
                });
        } else {
            // Check if we clicked on a floor entity
            if (Cesium.defined(pickedFeature) && pickedFeature.id && pickedFeature.id.id) {
                const entityId = pickedFeature.id.id;
                
                // Check if this is a floor entity
                if (typeof entityId === 'string' && entityId.startsWith('floor_')) {
                    // Handle floor selection
                    console.log(`Selected floor entity: ${entityId}`);
                    
                    // Extract floor info from the entity
                    const floorProps = pickedFeature.id.properties;
                    if (floorProps) {
                        const floorNumber = floorProps.floorNumber ? floorProps.floorNumber.getValue() : null;
                        const buildingId = floorProps.buildingId ? floorProps.buildingId.getValue() : null;
                        
                        if (floorNumber !== null && buildingId) {
                            console.log(`Clicked on floor ${floorNumber + 1} of building ${buildingId}`);
                            // You could add specific floor info display here
                        }
                    }
                    
                    return; // Don't hide info panel if we clicked on a floor
                }
            }
            
            // If no building or floor was clicked, hide the info panel and clear floor models
            this.infoPanel.hide();
            this.floorGenerator.removeAllFloorModels();
            this.currentBuildingId = null;
        }
    }
    
    /**
     * Toggle floor model display
     * @param {boolean} show - Whether to show floor models
     */
    toggleFloorModels(show) {
        this.showFloorsForSelectedBuilding = show;
        console.log(`Floor visualization ${show ? 'enabled' : 'disabled'}`);
        
        // Add visual debug indicator
        if (show) {
            const indicator = document.createElement('div');
            indicator.id = 'floorDebugIndicator';
            indicator.style.position = 'absolute';
            indicator.style.top = '10px';
            indicator.style.left = '10px';
            indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            indicator.style.color = 'white';
            indicator.style.padding = '5px 10px';
            indicator.style.borderRadius = '3px';
            indicator.style.zIndex = '2000';
            indicator.textContent = 'Floor Debug Mode: ON';
            document.body.appendChild(indicator);
        } else {
            const indicator = document.getElementById('floorDebugIndicator');
            if (indicator) {
                indicator.remove();
            }
        }
        
        // Clean up any existing error messages
        this.hideFloorGenerationError();
        
        if (this.currentBuildingId) {
            if (show) {
                // If we should show floors and have a selected building with properties
                if (this.selectedFeature) {
                    console.log('Displaying floors for building:', this.currentBuildingId);
                    
                    // First ensure any existing floor models are removed
                    this.floorGenerator.removeAllFloorModels();
                    
                    // Get the building's actual position from the screen coordinates
                    // This ensures we have a position even if the 3D model failed to load
                    const buildingScreenPosition = this.getSelectedFeatureScreenPosition();
                    console.log('Screen position for selected building:', buildingScreenPosition);
                    
                    // Calculate the current Earth location from the screen position if possible
                    const earthPosition = this.getEarthPositionFromScreen(buildingScreenPosition);
                    console.log('Earth position for selected building:', earthPosition);
                    
                    // Fetch properties for the building
                    this.dataService.getPropertiesByPandId(this.currentBuildingId)
                        .then(properties => {
                            if (properties && properties.length > 0) {
                                console.log(`Got ${properties.length} properties for floor generation`);
                                
                                // Highlight the selected building more prominently for better visibility
                                if (this.selectedFeature) {
                                    this.selectedFeature.color = Cesium.Color.YELLOW.withAlpha(0.9);
                                }
                                
                                // Set the building's real-world coordinates for floor generation
                                if (earthPosition) {
                                    const positionInfo = {
                                        position: earthPosition,
                                        screenPosition: buildingScreenPosition
                                    };
                                    this.floorGenerator.setBuildingPosition(this.currentBuildingId, positionInfo);
                                }
                                
                                // Generate the floors with a small delay to ensure UI is updated
                                setTimeout(() => {
                                    try {
                                        // Generate floor models directly at the building's location
                                        const success = this.floorGenerator.generateFloorModels(this.selectedFeature, properties);
                                        
                                        if (success) {
                                            console.log('Floor models successfully generated at building location');
                                        } else {
                                            console.error('Failed to generate floor models');
                                            this.showFloorGenerationError();
                                        }
                                    } catch (error) {
                                        console.error('Error generating floor models:', error);
                                        this.showFloorGenerationError();
                                    }
                                }, 200);
                            } else {
                                console.error('No properties found for floor generation');
                                this.showFloorGenerationError('No properties found for this building');
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching properties for floor generation:', error);
                            this.showFloorGenerationError('Error fetching building data');
                        });
                } else {
                    console.error('No building feature selected');
                    this.showFloorGenerationError('No building selected');
                }
            } else {
                // Hide floors - don't destroy cached data, just hide the entities
                console.log('Hiding floor models');
                this.floorGenerator.setFloorsVisible(this.currentBuildingId, false);
                
                // Reset building highlight
                if (this.selectedFeature) {
                    this.selectedFeature.color = Cesium.Color.YELLOW.withAlpha(0.7);
                }
            }
            
            // Update UI
            this.infoPanel.updateFloorToggleButton(show);
        }
    }
    
    /**
     * Get the screen position of the selected feature
     * @returns {Cesium.Cartesian2} Screen position
     */
    getSelectedFeatureScreenPosition() {
        if (!this.selectedFeature) return null;
        
        try {
            // Try to get the position from the feature's bounding volume
            let worldPosition = null;
            
            // Try using the feature's content position
            if (this.selectedFeature._content && this.selectedFeature._content.tile && 
                this.selectedFeature._content.tile.boundingSphere) {
                worldPosition = this.selectedFeature._content.tile.boundingSphere.center.clone();
            }
            
            // If we don't have a position, try the predefined building locations
            if (!worldPosition) {
                worldPosition = this.getKnownBuildingPosition(this.currentBuildingId);
            }
            
            // If we still don't have a position, use a default Rotterdam position
            if (!worldPosition) {
                worldPosition = Cesium.Cartesian3.fromDegrees(4.47917, 51.9225, 40); // Rotterdam center
            }
            
            // Convert the position to screen coordinates
            const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
                this.viewer.scene, 
                worldPosition
            );
            
            return screenPosition;
        } catch (error) {
            console.error('Error getting selected feature screen position:', error);
            return null;
        }
    }
    
    /**
     * Get Earth position from screen coordinates
     * @param {Cesium.Cartesian2} screenPosition - Screen position
     * @returns {Cesium.Cartesian3} Earth position
     */
    getEarthPositionFromScreen(screenPosition) {
        if (!screenPosition) return null;
        
        try {
            // Try to get the 3D position from the screen coordinates
            const ray = this.viewer.camera.getPickRay(screenPosition);
            const earthPosition = this.viewer.scene.globe.pick(ray, this.viewer.scene);
            
            // If we have a position, use it
            if (earthPosition) {
                return earthPosition;
            }
            
            // Otherwise, try a different approach - use the depth buffer
            const cartesian = this.viewer.camera.pickEllipsoid(screenPosition);
            if (cartesian) {
                return cartesian;
            }
            
            // If we still don't have a position, use the predefined building location
            return this.getKnownBuildingPosition(this.currentBuildingId);
        } catch (error) {
            console.error('Error getting earth position from screen:', error);
            return null;
        }
    }
    
    /**
     * Get a known building position for common building IDs
     * @param {string} buildingId - Building ID
     * @returns {Cesium.Cartesian3} Building position
     */
    getKnownBuildingPosition(buildingId) {
        // Predefined positions for common buildings shown in screenshots
        const knownBuildings = {
            '0599100000035588': {lng: 4.4727, lat: 51.92237, height: 60},   // Andre Gideplaats
            '0599100000305732': {lng: 4.47305, lat: 51.92235, height: 50},  // Hammarskjoldplaats
            '0599100000603742': {lng: 4.47423, lat: 51.92156, height: 45},  // Albert Camusplaats
            '0599100000679233': {lng: 4.47387, lat: 51.92348, height: 55},  // Tagoreplaats
            '0599100000603801': {lng: 4.47302, lat: 51.92119, height: 40},  // Other building
        };
        
        // If we have a predefined position for this building, use it
        if (buildingId && knownBuildings[buildingId]) {
            const pos = knownBuildings[buildingId];
            return Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.height);
        }
        
        // Otherwise, use a default Rotterdam position
        return Cesium.Cartesian3.fromDegrees(4.47917, 51.9225, 40);
    }
    
    /**
     * Extract the rotation of a building from its feature
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @returns {number} - Rotation angle in radians
     */
    getBuildingRotation(feature) {
        try {
            // Try to get rotation from feature transform
            if (feature._content && feature._content.tile && feature._content.tile.transform) {
                const transform = feature._content.tile.transform;
                // Extract rotation from matrix
                const matrix3 = new Cesium.Matrix3();
                Cesium.Matrix4.getRotation(transform, matrix3);
                const quaternion = Cesium.Quaternion.fromRotationMatrix(matrix3);
                const headingPitchRoll = Cesium.HeadingPitchRoll.fromQuaternion(quaternion);
                return headingPitchRoll.heading;
            }
        } catch (error) {
            console.warn('Could not extract building rotation:', error);
        }
        
        return 0; // Default rotation (no rotation)
    }
    
    /**
     * Create floor description with property information
     * @param {number} floorNum - Floor number
     * @param {Array} properties - Properties on this floor
     * @param {string} buildingId - Building ID
     * @returns {string} - HTML description
     */
    createFloorDescription(floorNum, properties, buildingId) {
        let description = `<h3>Floor ${floorNum + 1}</h3>`;
        description += `<p><strong>Building:</strong> ${buildingId}</p>`;
        
        if (properties && properties.length > 0) {
            description += `<p><strong>Units on this floor:</strong> ${properties.length}</p>`;
            description += `<h4>Properties:</h4><ul>`;
            
            properties.forEach((prop, index) => {
                if (index < 10) { // Limit to 10 properties for performance
                    description += `<li>${prop.straat || ''} ${prop.hnr || ''}${prop.hltr || ''} (${prop.pstc || ''})</li>`;
                }
            });
            
            if (properties.length > 10) {
                description += `<li>...and ${properties.length - 10} more properties</li>`;
            }
            
            description += '</ul>';
        } else {
            description += '<p>No properties found on this floor</p>';
        }
        
        return description;
    }
    
    /**
     * Show floor generation error
     * @param {string} message - Error message
     */
    showFloorGenerationError(message = 'Failed to generate floor models') {
        // First hide any existing error
        this.hideFloorGenerationError();
        
        // Create error container
        const errorContainer = document.createElement('div');
        errorContainer.id = 'floorGenerationError';
        errorContainer.style.position = 'absolute';
        errorContainer.style.top = '150px';
        errorContainer.style.left = '25px';
        errorContainer.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
        errorContainer.style.color = 'white';
        errorContainer.style.padding = '15px';
        errorContainer.style.borderRadius = '5px';
        errorContainer.style.zIndex = '2000';
        errorContainer.style.maxWidth = '300px';
        errorContainer.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
        
        // Create error content
        errorContainer.innerHTML = `
            <h3 style="margin-top:0;">Floor Generation Error</h3>
            <p>${message}</p>
            <p>Try selecting a different building or adjusting the camera position.</p>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button id="dismissErrorBtn" style="flex:1;padding:5px 10px;background:#555;border:none;color:white;border-radius:3px;cursor:pointer;">Dismiss</button>
                <button id="retryErrorBtn" style="flex:1;padding:5px 10px;background:#007bff;border:none;color:white;border-radius:3px;cursor:pointer;">Retry</button>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(errorContainer);
        
        // Add event listeners
        document.getElementById('dismissErrorBtn').addEventListener('click', () => {
            this.hideFloorGenerationError();
        });
        
        // Add retry functionality
        document.getElementById('retryErrorBtn').addEventListener('click', () => {
            // Hide the error message
            this.hideFloorGenerationError();
            
            // Enable debug mode to get more verbose logging
            console.log('Retrying floor generation with enhanced position detection...');
            
            // Use the fallback positioning method
            this.retryFloorGeneration();
        });
    }
    
    /**
     * Retry floor generation with improved positioning
     */
    retryFloorGeneration() {
        if (!this.currentBuildingId) return;
        
        console.log('Retrying floor generation for building:', this.currentBuildingId);
        
        try {
            // Remove any existing floor models
            this.floorGenerator.removeAllFloorModels();
            
            // Get hardcoded coordinates for this building
            const position = this.getKnownBuildingPosition(this.currentBuildingId);
            console.log('Using predefined position for floor generation:', position);
            
            // Set the building position directly
            if (position) {
                this.floorGenerator.setBuildingPosition(this.currentBuildingId, {
                    position: position,
                    isManual: true
                });
            }
            
            // Fetch properties for the building
            this.dataService.getPropertiesByPandId(this.currentBuildingId)
                .then(properties => {
                    if (properties && properties.length > 0) {
                        console.log(`Got ${properties.length} properties for retry`);
                        
                        setTimeout(() => {
                            try {
                                // Generate floor models with the fallback feature
                                const success = this.floorGenerator.generateFloorModels(this.selectedFeature, properties);
                                
                                if (!success) {
                                    // If normal generation fails, try direct generation
                                    this.generateFallbackFloors(properties, position);
                                }
                            } catch (error) {
                                console.error('Error in retry process:', error);
                                this.generateFallbackFloors(properties, position);
                            }
                        }, 200);
                    } else {
                        console.error('No properties found for building');
                        this.showFloorGenerationError('No properties found for this building');
                    }
                })
                .catch(error => {
                    console.error('Error fetching properties:', error);
                    this.showFloorGenerationError('Error fetching building data');
                });
        } catch (error) {
            console.error('Error in retry process:', error);
            this.showFloorGenerationError('Failed to retry floor generation');
        }
    }
    
    /**
     * Create fallback floors when all else fails
     * @param {Array} properties - Building properties
     * @param {Cesium.Cartesian3} position - Building position
     */
    generateFallbackFloors(properties, position) {
        if (!properties || properties.length === 0 || !position) {
            console.error('Cannot generate fallback floors: missing properties or position');
            return;
        }
        
        try {
            console.log('Generating fallback floors at position:', position);
            
            // Get building ID
            const buildingId = this.currentBuildingId;
            
            // Determine total floors
            const firstProp = properties[0];
            let totalFloors = 15; // Default
            
            if (firstProp.aant_bwlg_pnd && firstProp.aant_bwlg_pnd > 0) {
                totalFloors = firstProp.aant_bwlg_pnd;
            } else if (firstProp.hoogste_bwlg_pnd !== undefined && 
                      firstProp.laagste_bwlg_pnd !== undefined) {
                totalFloors = firstProp.hoogste_bwlg_pnd - firstProp.laagste_bwlg_pnd + 1;
            }
            
            // Calculate floor height - standard height of 3 meters per floor
            const floorHeight = 3;
            const buildingHeight = totalFloors * floorHeight;
            
            // Create a cartographic position from the Cartesian
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            
            // Calculate the bottom of the building
            const buildingBottom = cartographic.height - (buildingHeight / 2);
            
            // Generate orientation quaternion for horizontal alignment
            const eastNorthUp = Cesium.Transforms.eastNorthUpToFixedFrame(position);
            const rotationMatrix = Cesium.Matrix4.getMatrix3(eastNorthUp, new Cesium.Matrix3());
            const quaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
            
            // Create floor entities
            const floorEntities = [];
            
            // Create a floor for each level
            for (let floorNum = 0; floorNum < totalFloors; floorNum++) {
                // Calculate floor position
                const floorZ = buildingBottom + (floorNum * floorHeight) + (floorHeight / 2);
                
                // Create position for this floor
                const floorPosition = Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    floorZ
                );
                
                // Get properties on this floor
                const floorProperties = properties.filter(p => p.bwlg_vb0 === floorNum);
                
                // Generate color gradient from red (bottom) to blue (top)
                let color;
                if (floorNum === 0) {
                    color = Cesium.Color.RED.withAlpha(0.7);
                } else if (floorNum === totalFloors - 1) {
                    color = Cesium.Color.BLUE.withAlpha(0.7);
                } else {
                    const hue = 0.6 - ((floorNum / totalFloors) * 0.6);
                    color = Cesium.Color.fromHsl(hue, 0.8, 0.5, 0.7);
                }
                
                // Create floor entity
                const entity = new Cesium.Entity({
                    id: `floor_${buildingId}_${floorNum}`,
                    name: `Floor ${floorNum + 1}`,
                    position: floorPosition,
                    orientation: quaternion,
                    box: {
                        dimensions: new Cesium.Cartesian3(30, 30, floorHeight * 0.8),
                        material: color,
                        outline: true,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    },
                    label: {
                        text: `Floor ${floorNum + 1}${floorProperties.length > 0 ? ` (${floorProperties.length} units)` : ''}`,
                        font: '14px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.CENTER,
                        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                        pixelOffset: new Cesium.Cartesian2(20, 0),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8)
                    },
                    description: this.createFloorDescription(floorNum, floorProperties, buildingId)
                });
                
                // Add to scene
                this.viewer.entities.add(entity);
                floorEntities.push(entity);
            }
            
            // Store the created entities
            this.floorGenerator.floorEntities.set(buildingId, floorEntities);
            
            // Add a building outline to help visualize
            this.viewer.entities.add({
                id: `building_outline_${buildingId}`,
                name: `Building ${buildingId} Outline`,
                position: position,
                orientation: quaternion,
                box: {
                    dimensions: new Cesium.Cartesian3(35, 35, buildingHeight),
                    fill: false,
                    outline: true,
                    outlineColor: Cesium.Color.YELLOW.withAlpha(0.8),
                    outlineWidth: 2
                }
            });
            
            // Show success message
            this.showNotification(`Generated ${totalFloors} floors at building position`, 'success');
        } catch (error) {
            console.error('Error generating fallback floors:', error);
            this.showFloorGenerationError('Failed to generate fallback floors');
        }
    }
    
    /**
     * Show a notification to the user
     * @param {string} message - Message text
     * @param {string} type - Notification type: 'info', 'success', 'warning', 'error'
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.position = 'absolute';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.color = 'white';
        notification.style.zIndex = '2000';
        notification.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
        notification.textContent = message;
        
        // Set color based on type
        switch(type) {
            case 'success':
                notification.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
                break;
            case 'warning':
                notification.style.backgroundColor = 'rgba(255, 193, 7, 0.9)';
                break;
            case 'error':
                notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
                break;
            default:
                notification.style.backgroundColor = 'rgba(23, 162, 184, 0.9)';
        }
        
        // Add to document
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Hide the floor generation error message
     */
    hideFloorGenerationError() {
        const errorDiv = document.getElementById('floorGenerationError');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
    
    /**
     * Generate floor models for the selected building
     * @param {Array} properties - Building properties
     * @returns {boolean} - Success or failure
     */
    generateFloors(properties) {
        if (!this.selectedFeature || !properties || properties.length === 0) {
            console.error('Cannot generate floors: No selected feature or properties');
            return false;
        }
        
        console.log('Generating floor models for selected building');
        console.log('Selected feature:', this.selectedFeature);
        
        // Log information about the feature to help with debugging
        if (this.selectedFeature.getPropertyNames) {
            const propertyNames = this.selectedFeature.getPropertyNames();
            console.log('Feature properties:', propertyNames);
            
            // Log some key properties
            ['id', 'PANDID', 'pandid', 'height', 'stories', 'floors'].forEach(prop => {
                if (this.selectedFeature.hasProperty(prop)) {
                    console.log(`Property ${prop}:`, this.selectedFeature.getProperty(prop));
                }
            });
        }
        
        // If we have a feature, check its content and bounding volume
        if (this.selectedFeature._content) {
            console.log('Feature has content');
            if (this.selectedFeature._content.tile) {
                const tile = this.selectedFeature._content.tile;
                console.log('Feature has tile');
                console.log('Has transform:', !!tile.transform);
                console.log('Has bounding volume:', !!tile.boundingVolume);
            }
        }
        
        // Try to generate floor models - attempt this several times with different approaches
        let success = this.floorGenerator.generateFloorModels(this.selectedFeature, properties);
        
        if (!success) {
            console.log('First floor generation attempt failed, trying with default positioning');
            
            // Try a more direct approach - just get the 3D position of the selected feature
            const position = this.getSelectedFeaturePosition();
            if (position) {
                console.log('Got position from selection:', position);
                
                // Create a simpler set of floor entities directly
                success = this.createSimpleFloors(properties, position);
            }
        }
        
        if (success) {
            console.log('Successfully generated floor models');
        } else {
            console.error('Failed to generate floor models');
        }
        
        return success;
    }
    
    /**
     * Get the position of the selected feature 
     * @returns {Cesium.Cartesian3|null} - Position
     */
    getSelectedFeaturePosition() {
        try {
            if (!this.selectedFeature) return null;
            
            // Try to get position from picking a point on the feature
            const scene = this.viewer.scene;
            const canvas = this.viewer.canvas;
            
            // Get the center of the screen
            const windowPosition = new Cesium.Cartesian2(
                canvas.clientWidth / 2,
                canvas.clientHeight / 2
            );
            
            // Try to pick a position on the feature
            const pickedPosition = scene.pickPosition(windowPosition);
            if (Cesium.defined(pickedPosition)) {
                console.log('Got position from scene.pickPosition');
                return pickedPosition;
            }
            
            // Try to get position from the 3D tiles
            const pickRay = scene.camera.getPickRay(windowPosition);
            const position = scene.globe.pick(pickRay, scene);
            if (Cesium.defined(position)) {
                console.log('Got position from globe.pick');
                return position;
            }
            
            // If we can't get a picked position, use the current camera position
            // and place the buildings a bit in front of the camera
            const cameraPosition = scene.camera.position;
            const cameraDirection = scene.camera.direction;
            
            const positionOffset = Cesium.Cartesian3.multiplyByScalar(
                cameraDirection,
                100, // 100 meters in front of the camera
                new Cesium.Cartesian3()
            );
            
            const estimatedPosition = Cesium.Cartesian3.add(
                cameraPosition,
                positionOffset,
                new Cesium.Cartesian3()
            );
            
            console.log('Using estimated position in front of camera');
            return estimatedPosition;
        } catch (error) {
            console.error('Error getting feature position:', error);
            return null;
        }
    }
    
    /**
     * Create a simpler set of floor entities when the normal approach fails
     * @param {Array} properties - Building properties
     * @param {Cesium.Cartesian3} position - Position to place floors
     * @returns {boolean} - Success or failure
     */
    createSimpleFloors(properties, position) {
        try {
            // Get the cartographic position
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            
            // Get floor count from properties
            const firstProp = properties[0];
            let totalFloors = 15; // Default
            
            if (firstProp.aant_bwlg_pnd && firstProp.aant_bwlg_pnd > 0) {
                totalFloors = firstProp.aant_bwlg_pnd;
            } else if (firstProp.hoogste_bwlg_pnd !== undefined && 
                      firstProp.laagste_bwlg_pnd !== undefined) {
                totalFloors = firstProp.hoogste_bwlg_pnd - firstProp.laagste_bwlg_pnd + 1;
            }
            
            console.log(`Creating ${totalFloors} simple floors at position:`, position);
            
            // Estimate a reasonable building height
            const buildingHeight = totalFloors * 3.0; // 3 meters per floor
            const floorHeight = buildingHeight / totalFloors;
            
            // Clean up any existing floors
            this.floorGenerator.removeAllFloorModels();
            
            // Create floor entities
            const floorEntities = [];
            const buildingId = properties[0].pandid || 'unknown_building';
            
            // Create floors from bottom to top
            for (let floorNum = 0; floorNum < totalFloors; floorNum++) {
                // Calculate floor position
                const baseHeight = cartographic.height - (buildingHeight / 2);
                const floorBaseHeight = baseHeight + (floorNum * floorHeight);
                const floorCenterHeight = floorBaseHeight + (floorHeight / 2);
                
                // Create position for this floor
                const floorPosition = Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    floorCenterHeight
                );
                
                // Find properties on this floor
                const propsOnFloor = properties.filter(p => p.bwlg_vb0 === floorNum);
                
                // Generate a color based on floor position
                let color;
                if (floorNum === 0) {
                    color = Cesium.Color.RED.withAlpha(0.7);
                } else if (floorNum === totalFloors - 1) {
                    color = Cesium.Color.BLUE.withAlpha(0.7);
                } else {
                    const hue = 0.6 - ((floorNum / totalFloors) * 0.6); // blue to red
                    color = Cesium.Color.fromHsl(hue, 0.8, 0.5, 0.7);
                }
                
                // Create entity
                const entity = new Cesium.Entity({
                    id: `floor_${buildingId}_${floorNum}`,
                    name: `Floor ${floorNum + 1}`,
                    position: floorPosition,
                    box: {
                        dimensions: new Cesium.Cartesian3(
                            50, // width
                            80, // length
                            floorHeight * 0.9
                        ),
                        material: color,
                        outline: true,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    },
                    label: {
                        text: `Floor ${floorNum + 1}`,
                        font: '14px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.CENTER,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                        pixelOffset: new Cesium.Cartesian2(0, 0),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                
                // Add to viewer
                this.viewer.entities.add(entity);
                floorEntities.push(entity);
            }
            
            // Save the entities
            this.floorGenerator.floorEntities.set(buildingId, floorEntities);
            
            // Add debug markers
            this.addDebugMarkers(position, buildingId);
            
            return floorEntities.length > 0;
        } catch (error) {
            console.error('Error creating simple floors:', error);
            return false;
        }
    }
    
    /**
     * Add debug markers for troubleshooting
     * @param {Cesium.Cartesian3} position - Building position
     * @param {string} buildingId - Building ID
     */
    addDebugMarkers(position, buildingId) {
        // Add a marker for the building center
        this.viewer.entities.add({
            id: `debug_building_${buildingId}_center`,
            position: position,
            point: {
                pixelSize: 15,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: `Building ${buildingId}`,
                font: '16px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                showBackground: true,
                backgroundColor: Cesium.Color.DARKBLUE.withAlpha(0.7)
            }
        });
    }
    
    /**
     * Get the PANDID for a feature
     * @param {Cesium.Cesium3DTileFeature} feature - The clicked feature
     * @returns {Promise<string|null>} - The PANDID if found, null otherwise
     */
    async getFeatureBuildingId(feature) {
        try {
            // Log all available properties for debugging
            console.log("Feature properties:");
            if (feature.getPropertyNames) {
                const propertyNames = feature.getPropertyNames();
                console.log("Available properties:", propertyNames);
                
                for (const name of propertyNames) {
                    console.log(`${name}: ${feature.getProperty(name)}`);
                    
                    // Check if any property contains a PANDID-like string
                    const propValue = String(feature.getProperty(name));
                    if (propValue.match(/^[0-9]{16}$/)) {
                        console.log(`Found potential PANDID in property ${name}: ${propValue}`);
                    }
                }
            }
            
            // Check for properties that might contain the PANDID
            for (const propName of ['PANDID', 'pandid', 'id', 'ID', 'buildingId', 'gml:id']) {
                if (feature.hasProperty(propName)) {
                    const value = feature.getProperty(propName);
                    console.log(`Found property ${propName} with value ${value}`);
                    
                    // If it looks like a PANDID (16 digits), use it
                    if (typeof value === 'string' && value.match(/^[0-9]{16}$/)) {
                        return value;
                    }
                }
            }
            
            // If a gml.id is available, try to use that as it might match our PANDID format
            if (feature.hasProperty('gml:id')) {
                let gmlId = feature.getProperty('gml:id');
                // Clean the string and see if it contains a valid PANDID
                const matches = String(gmlId).match(/[0-9]{16}/);
                if (matches && matches.length > 0) {
                    return matches[0];
                }
            }
            
            // Try to extract building ID from feature data
            // Some 3D tile formats store it in other ways
            const featureId = this.extractBuildingIdFromFeature(feature);
            if (featureId) {
                return featureId;
            }
            
            // If we couldn't find the ID, log a message and return null
            console.log("Could not find PANDID in feature properties");
            return null;
            
        } catch (error) {
            console.error('Error extracting feature ID:', error);
            return null;
        }
    }
    
    /**
     * Extract building ID from feature properties or metadata
     * @param {Cesium.Cesium3DTileFeature} feature - The clicked feature
     * @returns {string|null} - The building ID if found, null otherwise
     */
    extractBuildingIdFromFeature(feature) {
        try {
            // Access batch table or content (depends on the 3D tiles format)
            let batchTable = null;
            if (feature.content && feature.content.batchTable) {
                batchTable = feature.content.batchTable;
            } else if (feature._content && feature._content.batchTable) {
                batchTable = feature._content.batchTable;
            }
            
            if (batchTable) {
                console.log("Found batch table in feature");
                // Try to find PANDID in batch table
                
                // Log batch table properties
                if (batchTable.getPropertyNames) {
                    const names = batchTable.getPropertyNames();
                    console.log("Batch table properties:", names);
                    
                    // Check each property for a PANDID
                    for (const name of names) {
                        if (name.toLowerCase().includes('id')) {
                            const value = batchTable.getProperty(feature.batchId, name);
                            console.log(`Batch table property ${name}: ${value}`);
                            
                            if (typeof value === 'string' && value.match(/^[0-9]{16}$/)) {
                                return value;
                            }
                        }
                    }
                }
            }
            
            // If we reach here, no PANDID was found
            return null;
            
        } catch (error) {
            console.error("Error extracting building ID from feature:", error);
            return null;
        }
    }
    
    /**
     * Select a feature and highlight it
     * @param {Cesium.Cesium3DTileFeature} feature - The feature to select
     */
    selectFeature(feature) {
        // Store the selected feature
        this.selectedFeature = feature;
        
        if (feature) {
            // Apply a bright yellow highlight to the selected building for clear indication
            feature.color = Cesium.Color.YELLOW.withAlpha(0.8);
            console.log("Building selected - highlighting yellow");
        }
    }
    
    /**
     * Clear the current selection
     */
    clearSelection() {
        if (this.selectedFeature) {
            // First try to get the building ID
            let buildingId = null;
            
            try {
                if (this.selectedFeature.getPropertyNames) {
                    const propertyNames = this.selectedFeature.getPropertyNames();
                    
                    for (const propName of propertyNames) {
                        const value = this.selectedFeature.getProperty(propName);
                        
                        // If it looks like a PANDID, use it
                        if (typeof value === 'string') {
                            if (value.match(/^[0-9]{16}$/)) {
                                buildingId = value;
                                break;
                            }
                            
                            // Try to extract PANDID from longer strings
                            const match = value.match(/([0-9]{16})/);
                            if (match && match[1]) {
                                buildingId = match[1];
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error getting building ID for clearSelection:", error);
            }
            
            // If we have a style manager and building ID, use it to determine the correct color
            if (this.styleManager && buildingId) {
                const inDataset = this.styleManager.hasBuildingData(buildingId);
                if (inDataset) {
                    // Building is in the dataset, color it white
                    this.selectedFeature.color = Cesium.Color.WHITE.withAlpha(0.7);
                    console.log(`Building ${buildingId} is in dataset, resetting to white`);
                } else {
                    // Building is not in the dataset, color it gray
                    this.selectedFeature.color = Cesium.Color.GRAY.withAlpha(0.5);
                    console.log(`Building ${buildingId} is NOT in dataset, resetting to gray`);
                }
            } else {
                // No style manager or building ID, use default white color
                this.selectedFeature.color = Cesium.Color.WHITE.withAlpha(0.7);
            }
            
            this.selectedFeature = null;
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.handler) {
            this.handler.destroy();
        }
        
        if (this.floorGenerator) {
            this.floorGenerator.destroy();
        }
    }
}