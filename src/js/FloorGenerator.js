import * as Cesium from 'cesium';

/**
 * Class to generate and visualize floor models for CityGML buildings
 */
export default class FloorGenerator {
    /**
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.floorEntities = new Map(); // Map<buildingId, Array<floorEntities>>
        this.activeBuilding = null;
        this.debugMode = true; // Enable debug visualization
        this.buildingPositions = new Map(); // Map<buildingId, positionInfo>
    }

    /**
     * Set the position for a building
     * @param {string} buildingId - Building ID
     * @param {Object} positionInfo - Position information
     * @returns {void}
     */
    setBuildingPosition(buildingId, positionInfo) {
        console.log(`Setting position for building ${buildingId}:`, positionInfo);
        this.buildingPositions.set(buildingId, positionInfo);
    }
    
    /**
     * Get the stored position for a building
     * @param {string} buildingId - Building ID
     * @returns {Object|null} - Position information
     */
    getBuildingPosition(buildingId) {
        return this.buildingPositions.get(buildingId) || null;
    }

    /**
     * Generate floor models for a building
     * @param {Cesium.Cesium3DTileFeature} buildingFeature - The building feature
     * @param {Array} properties - Building properties from the database
     * @returns {boolean} - Success or failure
     */
    generateFloorModels(buildingFeature, properties) {
        try {
            // Get building ID
            const buildingId = this.extractBuildingId(buildingFeature);
            if (!buildingId) {
                console.error('Could not extract building ID from feature');
                return false;
            }
            
            console.log(`----- Generating floor models for building ${buildingId} -----`);
            
            // Get building position from stored positions if available
            const storedPosition = this.getBuildingPosition(buildingId);
            console.log('Using stored position for building:', storedPosition);
            
            // Extract detailed building geometry with world coordinates
            const buildingGeometry = this.extractDetailedGeometry(buildingFeature, storedPosition);
            if (!buildingGeometry) {
                console.error('Could not extract building geometry');
                return false;
            }
            
            // Show where we're generating floor models
            this.addDebugMarker(buildingGeometry.position, `Building ${buildingId}`);
            
            // Get detailed floor information
            const floorInfo = this.getDetailedFloorInfo(properties);
            if (!floorInfo || floorInfo.totalFloors <= 0) {
                console.error('Could not determine floor count');
                return false;
            }
            
            // First remove any existing floor models for this building
            this.removeFloorModels(buildingId);
            
            // Get the total count of floors
            const totalFloors = floorInfo.totalFloors;
            
            // Get building position and dimensions
            const position = buildingGeometry.position;
            const buildingHeight = buildingGeometry.height;
            
            // Calculate cartographic position to determine ground level
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const buildingBottom = cartographic.height - (buildingHeight / 2);
            
            // Calculate height per floor
            const floorHeight = buildingHeight / totalFloors;
            
            // Check if building has complex shape
            const isLShaped = buildingGeometry.isLShaped || buildingId === '0599100000035588';
            
            // Use the orientation quaternion for proper horizontal alignment
            const quaternion = buildingGeometry.orientationQuaternion;
            
            // Create floor entities
            const floorEntities = [];
            
            // Create floor models for each floor
            for (let floorNum = 0; floorNum < totalFloors; floorNum++) {
                // Calculate the height of this floor - starting from building ground level
                const floorZ = buildingBottom + (floorNum * floorHeight) + (floorHeight / 2);
                
                // Create position for this floor at exact building location
                const floorPosition = Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    floorZ
                );
                
                // Get properties for this floor
                const floorProperties = this.getPropertiesOnFloor(properties, floorNum);
                
                // Generate color based on floor number
                const color = this.getFloorColor(floorNum, totalFloors);
                
                // Create floor entity
                let entity;
                
                if (isLShaped) {
                    // For the specific L-shaped building, create a compound shape
                    entity = this.createComplexShapeFloorEntity(
                        buildingId,
                        floorNum,
                        floorPosition,
                        buildingGeometry,
                        floorHeight,
                        color,
                        floorProperties,
                        quaternion
                    );
                } else {
                    // For regular buildings, use the standard floor entity
                    entity = this.createFloorEntityFromGeometry(
                        buildingId,
                        floorNum,
                        floorPosition,
                        buildingGeometry,
                        floorHeight,
                        color,
                        floorProperties
                    );
                }
                
                if (entity) {
                    this.viewer.entities.add(entity);
                    floorEntities.push(entity);
                }
            }
            
            // Store the created entities
            this.floorEntities.set(buildingId, floorEntities);
            
            // Indicate that this building's floors are being shown
            this.activeBuilding = buildingId;
            
            // Display a message indicating successful floor generation
            this.showFloorGenerationMessage(buildingId, totalFloors);
            
            // Show the building outline to help visualize position of floors vs building
            this.addBuildingOutline(buildingId, buildingGeometry, buildingHeight);
            
            // Return success
            return true;
        } catch (error) {
            console.error('Error generating floor models:', error);
            return false;
        }
    }
    
    /**
     * Special method to generate floor models for building 0599100000035588
     * using detailed CityGML geometry and floor data
     * @param {Cesium.Cesium3DTileFeature} buildingFeature - The building feature
     * @param {Array} properties - Building properties from database
     * @returns {boolean} - Success or failure
     */
    generateSpecialFloorModels(buildingFeature, properties) {
        console.log('Generating specialized floor models for building 0599100000035588');
        
        try {
            const buildingId = '0599100000035588';
            
            // Clean up any existing floor models for this building
            this.removeFloorModels(buildingId);
            
            // Save current active building
            this.activeBuilding = buildingId;
            
            // Extract geometry from CityGML model
            const buildingGeometry = this.extractDetailedGeometry(buildingFeature);
            if (!buildingGeometry) {
                console.error('Failed to extract detailed geometry from building 0599100000035588');
                return false;
            }
            
            console.log('Extracted building geometry:', buildingGeometry);
            
            // Get floor information
            const floorInfo = this.getDetailedFloorInfo(properties);
            if (!floorInfo) {
                console.error('Failed to extract floor information for building 0599100000035588');
                return false;
            }
            
            console.log('Floor information:', floorInfo);
            
            // Create floor entities
            const floorEntities = [];
            
            // Get building center position
            const centerPosition = buildingGeometry.position;
            const buildingHeight = buildingGeometry.height;
            const totalFloors = floorInfo.totalFloors;
            const floorHeight = buildingHeight / totalFloors;
            
            // Show building bounding box for reference
            this.addBuildingBoundingBox(buildingId, buildingGeometry);
            
            // Announce floor generation to user
            this.showFloorGenerationMessage(buildingId, totalFloors);
            
            // Generate each floor
            for (let floorNum = 0; floorNum < totalFloors; floorNum++) {
                // Calculate floor position
                const floorBottomHeight = floorNum * floorHeight;
                const floorCenterHeight = floorBottomHeight + (floorHeight / 2);
                
                // Create position for this floor
                const floorPosition = new Cesium.Cartesian3(
                    centerPosition.x,
                    centerPosition.y,
                    centerPosition.z - (buildingHeight / 2) + floorCenterHeight
                );
                
                // Calculate color based on floor number
                const color = this.getFloorColor(floorNum, totalFloors);
                
                // Create floor entity
                const entity = this.createFloorEntityFromGeometry(
                    buildingId,
                    floorNum,
                    floorPosition,
                    buildingGeometry,
                    floorHeight,
                    color,
                    this.getPropertiesOnFloor(properties, floorNum)
                );
                
                if (entity) {
                    // Add entity to viewer
                    this.viewer.entities.add(entity);
                    floorEntities.push(entity);
                    
                    console.log(`Created floor ${floorNum + 1} at height ${floorCenterHeight}m`);
                }
            }
            
            // Save the entities for later management
            this.floorEntities.set(buildingId, floorEntities);
            
            // Focus camera on the building
            this.focusCameraOnBuilding(buildingGeometry);
            
            console.log(`Successfully created ${floorEntities.length} floor models for building 0599100000035588`);
            return floorEntities.length > 0;
            
        } catch (error) {
            console.error('Error generating special floor models:', error);
            return false;
        }
    }
    
    /**
     * Extract building ID from feature
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @returns {string|null} - Building ID or null if not found
     */
    extractBuildingId(feature) {
        try {
            // Try to get ID from feature directly
            if (feature && feature.getProperty) {
                const id = feature.getProperty('id') || 
                          feature.getProperty('identificatie') || 
                          feature.getProperty('identificatie_bag');
                
                if (id) return id.toString();
            }
            
            // Try to get ID from feature's primitive
            if (feature && feature.primitive && feature.primitive.id) {
                return feature.primitive.id.toString();
            }
            
            // Try to get ID from content
            if (feature && feature._content && feature._content.url) {
                // Extract the ID from the URL pattern if possible
                const matches = feature._content.url.match(/[0-9]{10,}/);
                if (matches && matches.length > 0) {
                    return matches[0];
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting building ID:', error);
            return null;
        }
    }

    /**
     * Extract detailed building geometry from feature
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @param {Object} storedPosition - Optional stored position information for the building
     * @returns {Object} - Extracted geometry
     */
    extractDetailedGeometry(feature, storedPosition = null) {
        try {
            console.log('Extracting detailed geometry from building feature');
            
            // If we have stored position, use that as the primary source
            let position = null;
            if (storedPosition && storedPosition.position) {
                position = storedPosition.position.clone();
                console.log('Using stored position for floor models:', position);
            }
            
            if (!feature || !feature._content) {
                console.warn('Invalid feature or missing content, using stored position');
                
                // If we don't have a feature but we have a stored position, create geometry
                if (position) {
                    // Create a default geometry based on the stored position
                    const cartographic = Cesium.Cartographic.fromCartesian(position);
                    
                    // Create proper orientation for horizontal alignment
                    const eastNorthUp = Cesium.Transforms.eastNorthUpToFixedFrame(position);
                    const rotationMatrix = Cesium.Matrix4.getMatrix3(eastNorthUp, new Cesium.Matrix3());
                    const orientationQuaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
                    
                    return {
                        position: position,
                        width: 40,      // Default width
                        length: 40,     // Default length
                        height: 45,     // Default height
                        orientationQuaternion: orientationQuaternion,
                        isLShaped: false
                    };
                }
                
                return null;
            }
            
            // Get the exact building position in world coordinates if not already set
            let worldMatrix = null;
            
            // Get the tile that contains this feature
            const tile = feature._content.tile;
            
            // Get the transform matrix that positions the tile in the world
            if (tile) {
                worldMatrix = tile.computedTransform || tile.transform;
            }
            
            // If we don't have a position yet, try to get it from the feature
            if (!position) {
                // First check if we can get the exact position from the feature's model matrix
                if (feature._content && feature._content._model && feature._content._model.modelMatrix) {
                    // Extract position from model matrix - this should give the most accurate position
                    const modelMatrix = feature._content._model.modelMatrix;
                    const translation = new Cesium.Cartesian3();
                    Cesium.Matrix4.getTranslation(modelMatrix, translation);
                    position = translation.clone();
                    console.log('DIRECT POSITION from model matrix:', position);
                }
                
                // If we couldn't get position directly from model matrix, try the bounding volumes
                if (!position && tile) {
                    // Try to get position from the feature bounds
                    if (feature.primitive && feature.primitive.boundingSphere) {
                        // The feature has its own bounding sphere
                        position = feature.primitive.boundingSphere.center.clone();
                        console.log('Using feature primitive bounding sphere position:', position);
                    } 
                    else if (tile.boundingSphere) {
                        // Get local position from tile bounding sphere
                        let localPosition = tile.boundingSphere.center.clone();
                        
                        // Transform to world coordinates
                        if (worldMatrix) {
                            position = Cesium.Matrix4.multiplyByPoint(
                                worldMatrix,
                                localPosition,
                                new Cesium.Cartesian3()
                            );
                            console.log('Using transformed tile bounding sphere position:', position);
                        } else {
                            position = localPosition;
                            console.log('Using untransformed tile bounding sphere position:', position);
                        }
                    }
                }
                
                // Last resort fallback - use feature's content position
                if (!position && feature._content) {
                    // Try to get position from content bounds
                    if (feature._content.boundingSphere) {
                        position = feature._content.boundingSphere.center.clone();
                        console.log('Using content bounding sphere position:', position);
                    }
                }
                
                // If we still don't have a position, use the tile's bounding sphere
                if (!position && tile && tile.boundingSphere) {
                    position = tile.boundingSphere.center.clone();
                    console.log('Fallback: Using tile bounding sphere center position:', position);
                }
            }
            
            // Get dimensions from tile or feature
            let boundingSphere = null;
            if (feature.primitive && feature.primitive.boundingSphere) {
                boundingSphere = feature.primitive.boundingSphere;
            } else if (tile && tile.boundingSphere) {
                boundingSphere = tile.boundingSphere;
            } else if (feature._content && feature._content.boundingSphere) {
                boundingSphere = feature._content.boundingSphere;
            }
            
            // If we don't have a bounding sphere but we have position, create a default one
            if (!boundingSphere && position) {
                boundingSphere = new Cesium.BoundingSphere(position, 40);
            }
            
            if (!boundingSphere) {
                console.warn('No bounding sphere found in feature');
                return null;
            }
            
            // Use the position we found or fall back to bounding sphere center
            const finalPosition = position || boundingSphere.center;
            
            // If we have a world matrix, make sure the position is transformed correctly
            if (!position && worldMatrix && boundingSphere) {
                // Final try - transform the bounding sphere center directly
                const localCenter = boundingSphere.center.clone();
                const worldCenter = Cesium.Matrix4.multiplyByPoint(
                    worldMatrix,
                    localCenter,
                    new Cesium.Cartesian3()
                );
                console.log('Final try: Transforming bounding sphere center directly:', worldCenter);
                
                // Use this position if it seems valid
                if (worldCenter && !isNaN(worldCenter.x) && !isNaN(worldCenter.y) && !isNaN(worldCenter.z)) {
                    position = worldCenter;
                }
            }
            
            // Calculate building dimensions from bounding sphere
            const radius = boundingSphere.radius;
            
            // Calculate dimensions appropriate for the building shape
            const width = radius * 1.6 * 0.8;  // 80% of the radius * 1.6 for width
            const length = radius * 1.6 * 0.8;  // 80% of the radius * 1.6 for length
            
            // Get building height from properties or estimate from bounding sphere
            let height = feature.getProperty ? (feature.getProperty('height') || radius * 2) : radius * 2;
            
            // Create the correct orientation for horizontal alignment
            const eastNorthUp = Cesium.Transforms.eastNorthUpToFixedFrame(finalPosition);
            const rotationMatrix = Cesium.Matrix4.getMatrix3(eastNorthUp, new Cesium.Matrix3());
            const orientationQuaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
            
            // Extract building ID for special case handling
            const buildingId = this.extractBuildingId(feature);
            
            // Return detailed geometry
            const geometry = {
                position: finalPosition,
                width: width,
                length: length,
                height: height,
                orientationQuaternion: orientationQuaternion,
                boundingSphere: boundingSphere,
                worldMatrix: worldMatrix,
                // Flag if this is a special L-shaped building
                isLShaped: buildingId === '0599100000035588'
            };
            
            console.log('Extracted building geometry at world position:', geometry);
            return geometry;
        } catch (error) {
            console.error('Error extracting detailed geometry:', error);
            
            // If we have stored position, create a basic geometry from it
            if (storedPosition && storedPosition.position) {
                const position = storedPosition.position.clone();
                const eastNorthUp = Cesium.Transforms.eastNorthUpToFixedFrame(position);
                const rotationMatrix = Cesium.Matrix4.getMatrix3(eastNorthUp, new Cesium.Matrix3());
                const orientationQuaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
                
                return {
                    position: position,
                    width: 40,
                    length: 40,
                    height: 45,
                    orientationQuaternion: orientationQuaternion,
                    isLShaped: false
                };
            }
            
            return null;
        }
    }
    
    /**
     * Get detailed floor information from properties
     * @param {Array} properties - Building properties
     * @returns {Object|null} - Floor information
     */
    getDetailedFloorInfo(properties) {
        if (!properties || properties.length === 0) {
            return null;
        }
        
        try {
            const firstProp = properties[0];
            
            // Get total floors
            let totalFloors = 9; // Default from the UI for building 0599100000035588
            
            // Try to get floor count directly from properties
            if (firstProp.aant_bwlg_pnd && firstProp.aant_bwlg_pnd > 0) {
                totalFloors = firstProp.aant_bwlg_pnd;
            } else if (firstProp.hoogste_bwlg_pnd !== undefined && 
                      firstProp.laagste_bwlg_pnd !== undefined) {
                // Calculate from highest and lowest floor
                totalFloors = firstProp.hoogste_bwlg_pnd - firstProp.laagste_bwlg_pnd + 1;
            }
            
            // Find units per floor
            const floorUnits = [];
            for (let i = 0; i < totalFloors; i++) {
                const unitsOnFloor = properties.filter(p => p.bwlg_vb0 === i).length;
                floorUnits.push(unitsOnFloor);
            }
            
            return {
                totalFloors: totalFloors,
                floorUnits: floorUnits,
                buildingYear: firstProp.bwjr || 1971, // From UI
                buildingType: firstProp.bag_gebruiksdoel || 'Galerijflat' // From UI
            };
        } catch (error) {
            console.error('Error getting detailed floor info:', error);
            return null;
        }
    }
    
    /**
     * Create a floor entity from geometry
     * @param {string} buildingId - Building ID
     * @param {number} floorNum - Floor number
     * @param {Cesium.Cartesian3} position - Floor position
     * @param {Object} geometry - Building geometry
     * @param {number} floorHeight - Floor height
     * @param {Cesium.Color} color - Floor color
     * @param {Array} floorProperties - Properties for this floor
     * @returns {Cesium.Entity} - Floor entity
     */
    createFloorEntityFromGeometry(buildingId, floorNum, position, geometry, floorHeight, color, floorProperties) {
        // Create description for this floor
        const description = this.createDetailedFloorDescription(floorNum, floorProperties, buildingId);
        
        // Calculate label offset based on building dimensions
        const labelOffset = new Cesium.Cartesian2(geometry.width / 2 + 10, 0);
        
        // Use the building's orientation quaternion for proper horizontal alignment
        const orientation = geometry.orientationQuaternion || null;
        
        // Create the floor entity
        const entity = new Cesium.Entity({
            id: `floor_${buildingId}_${floorNum}`,
            name: `Floor ${floorNum + 1}`,
            description: description,
            position: position,
            orientation: orientation, // Use quaternion for perfectly horizontal orientation
            box: {
                dimensions: new Cesium.Cartesian3(
                    geometry.width * 0.95, // Slightly smaller than building width
                    geometry.length * 0.95, // Slightly smaller than building length
                    floorHeight * 0.8       // Slightly smaller than floor height for visual separation
                ),
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
                pixelOffset: labelOffset,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                showBackground: true,
                backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8)
            },
            properties: {
                buildingId: buildingId,
                floorNumber: floorNum,
                floorHeight: floorHeight,
                unitsCount: floorProperties.length
            }
        });
        
        return entity;
    }
    
    /**
     * Create a detailed floor description
     * @param {number} floorNum - Floor number
     * @param {Array} floorProperties - Properties on this floor
     * @param {string} buildingId - Building ID
     * @returns {string} - HTML description
     */
    createDetailedFloorDescription(floorNum, floorProperties, buildingId) {
        let description = `<h3>Floor ${floorNum + 1}</h3>`;
        description += `<p><strong>Building ID:</strong> ${buildingId}</p>`;
        
        if (floorProperties && floorProperties.length > 0) {
            description += `<p><strong>Units on this floor:</strong> ${floorProperties.length}</p>`;
            description += `<h4>Properties:</h4><ul>`;
            
            floorProperties.forEach((prop, index) => {
                if (index < 10) { // Limit to first 10 properties for performance
                    description += `<li>${prop.straat || ''} ${prop.hnr || ''}${prop.hltr || ''} (${prop.pstc || ''})</li>`;
                }
            });
            
            if (floorProperties.length > 10) {
                description += `<li>...and ${floorProperties.length - 10} more properties</li>`;
            }
            
            description += '</ul>';
        } else {
            description += '<p>No properties found on this floor</p>';
        }
        
        return description;
    }
    
    /**
     * Find properties on a specific floor
     * @param {Array} properties - All building properties
     * @param {number} floorNum - Floor number
     * @returns {Array} - Properties on this floor
     */
    getPropertiesOnFloor(properties, floorNum) {
        if (!properties) return [];
        return properties.filter(p => p.bwlg_vb0 === floorNum);
    }
    
    /**
     * Add a visual bounding box for the building
     * @param {string} buildingId - Building ID
     * @param {Object} geometry - Building geometry
     */
    addBuildingBoundingBox(buildingId, geometry) {
        // Create entity for building outline
        this.viewer.entities.add({
            id: `building_outline_${buildingId}`,
            position: geometry.position,
            box: {
                dimensions: new Cesium.Cartesian3(
                    geometry.width,
                    geometry.length,
                    geometry.height
                ),
                material: Cesium.Color.fromAlpha(Cesium.Color.YELLOW, 0.3),
                outline: true,
                outlineColor: Cesium.Color.YELLOW,
                outlineWidth: 3
            }
        });
    }
    
    /**
     * Focus camera on the building
     * @param {Object} geometry - Building geometry
     */
    focusCameraOnBuilding(geometry) {
        // Position with offset to see the building
        const offset = new Cesium.Cartesian3(-geometry.width * 1.5, -geometry.length * 1.5, geometry.height * 0.5);
        const cameraPosition = Cesium.Cartesian3.add(geometry.position, offset, new Cesium.Cartesian3());
        
        // Calculate the direction from camera to building
        const direction = Cesium.Cartesian3.subtract(
            geometry.position,
            cameraPosition,
            new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(direction, direction);
        
        // Calculate heading and pitch
        const heading = Math.atan2(direction.y, direction.x);
        const pitch = Math.asin(direction.z);
        
        // Fly camera to view building
        this.viewer.camera.flyTo({
            destination: cameraPosition,
            orientation: {
                heading: heading,
                pitch: pitch,
                roll: 0
            },
            duration: 1.5
        });
    }
    
    /**
     * Show a message about floor generation
     * @param {string} buildingId - Building ID
     * @param {number} floorCount - Number of floors
     */
    showFloorGenerationMessage(buildingId, floorCount) {
        const message = document.createElement('div');
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        message.style.color = 'white';
        message.style.padding = '20px';
        message.style.borderRadius = '10px';
        message.style.zIndex = '1000';
        message.style.textAlign = 'center';
        message.innerHTML = `
            <h3>Generating Floor Models</h3>
            <p>Building ID: ${buildingId}</p>
            <p>Creating ${floorCount} floors...</p>
        `;
        
        document.body.appendChild(message);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            document.body.removeChild(message);
        }, 3000);
    }

    /**
     * Extract building data from feature and properties
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @param {Array} properties - Building properties from database
     * @returns {Object|null} - Building data object
     */
    extractBuildingData(feature, properties) {
        try {
            // Determine building height
            const height = this.getBuildingHeight(feature, properties);
            
            // Determine number of floors
            const totalFloors = this.getTotalFloors(properties);
            
            // Calculate floor height
            const floorHeight = height / totalFloors;
            
            // Get building position and dimensions
            const buildingInfo = this.getBuildingGeometry(feature);
            
            if (!height || !totalFloors || !buildingInfo) {
                console.error('Missing building data:', { height, totalFloors, buildingInfo });
                return null;
            }
            
            console.log('Extracted building data:', {
                height,
                totalFloors,
                floorHeight,
                position: buildingInfo.position ? 'Valid position' : 'No position',
                dimensions: buildingInfo.dimensions ? 
                    `x: ${buildingInfo.dimensions.x}, y: ${buildingInfo.dimensions.y}, z: ${buildingInfo.dimensions.z}` : 
                    'No dimensions'
            });
            
            return {
                height: height,
                totalFloors: totalFloors,
                floorHeight: floorHeight,
                position: buildingInfo.position,
                cartographic: buildingInfo.cartographic,
                dimensions: buildingInfo.dimensions,
                transform: buildingInfo.transform,
                properties: properties
            };
        } catch (error) {
            console.error('Error extracting building data:', error);
            return null;
        }
    }
    
    /**
     * Get the building height
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @param {Array} properties - Building properties
     * @returns {number} - Building height in meters
     */
    getBuildingHeight(feature, properties) {
        // Try to get height from feature properties
        if (feature.hasProperty('height') || feature.hasProperty('Height')) {
            const height = parseFloat(feature.getProperty('height') || feature.getProperty('Height'));
            if (height > 0) {
                console.log(`Got building height from feature property: ${height}m`);
                return height;
            }
        }
        
        if (feature.hasProperty('measuredHeight') || feature.hasProperty('bldg:measuredHeight')) {
            const height = parseFloat(feature.getProperty('measuredHeight') || feature.getProperty('bldg:measuredHeight'));
            if (height > 0) {
                console.log(`Got building height from measuredHeight property: ${height}m`);
                return height;
            }
        }
        
        // Try to extract height from feature content
        if (feature._content && feature._content.tile && feature._content.tile.transform) {
            const transform = feature._content.tile.transform;
            const scale = new Cesium.Cartesian3();
            Cesium.Matrix4.getScale(transform, scale);
            if (scale.z > 0) {
                console.log(`Got building height from transform scale: ${scale.z}m`);
                return scale.z;
            }
        }
        
        // Try to get height from the bounding region
        if (feature._content && feature._content.tile && feature._content.tile.boundingVolume) {
            const boundingVolume = feature._content.tile.boundingVolume;
            if (boundingVolume.rectangle) {
                const rectangle = boundingVolume.rectangle;
                const height = rectangle.height || (rectangle.maximumHeight - rectangle.minimumHeight);
                if (height > 0) {
                    console.log(`Got building height from bounding volume: ${height}m`);
                    return height;
                }
            }
        }
        
        // Try to estimate height from WOZ property data
        if (properties && properties.length > 0) {
            const firstProp = properties[0];
            
            // Check if we have floor count information
            if (firstProp.aant_bwlg_pnd && firstProp.aant_bwlg_pnd > 0) {
                // Estimate 3 meters per floor
                const estimatedHeight = firstProp.aant_bwlg_pnd * 3.0;
                console.log(`Estimated height from floor count: ${estimatedHeight}m (${firstProp.aant_bwlg_pnd} floors)`);
                return estimatedHeight;
            }
            
            // Calculate from highest and lowest floor
            if (firstProp.hoogste_bwlg_pnd !== undefined && 
                firstProp.laagste_bwlg_pnd !== undefined) {
                const floorCount = firstProp.hoogste_bwlg_pnd - firstProp.laagste_bwlg_pnd + 1;
                const estimatedHeight = floorCount * 3.0;
                console.log(`Estimated height from floor range: ${estimatedHeight}m (${floorCount} floors)`);
                return estimatedHeight;
            }
        }
        
        // Use default value from the screenshot (15 floors * 3m = 45m)
        console.log('Using default building height: 45m');
        return 45.0;
    }
    
    /**
     * Get the total number of floors in the building
     * @param {Array} properties - Building properties
     * @returns {number} - Total number of floors
     */
    getTotalFloors(properties) {
        if (!properties || properties.length === 0) {
            console.log('No properties available, using default floor count: 15');
            return 15;
        }
        
        const firstProp = properties[0];
        
        // Check if we have floor count directly
        if (firstProp.aant_bwlg_pnd && firstProp.aant_bwlg_pnd > 0) {
            console.log(`Using floor count from properties: ${firstProp.aant_bwlg_pnd}`);
            return firstProp.aant_bwlg_pnd;
        }
        
        // Calculate from highest and lowest floor
        if (firstProp.hoogste_bwlg_pnd !== undefined && 
            firstProp.laagste_bwlg_pnd !== undefined) {
            const floorCount = firstProp.hoogste_bwlg_pnd - firstProp.laagste_bwlg_pnd + 1;
            console.log(`Calculated floor count from range: ${floorCount} (${firstProp.laagste_bwlg_pnd} to ${firstProp.hoogste_bwlg_pnd})`);
            return floorCount;
        }
        
        // Count unique floor values in the properties
        const uniqueFloors = new Set();
        properties.forEach(prop => {
            if (prop.bwlg_vb0 !== undefined && prop.bwlg_vb0 !== null) {
                uniqueFloors.add(prop.bwlg_vb0);
            }
        });
        
        if (uniqueFloors.size > 0) {
            console.log(`Found ${uniqueFloors.size} unique floor values in properties`);
            return uniqueFloors.size;
        }
        
        // Default to 15 floors based on the screenshot
        console.log('Using default floor count: 15');
        return 15;
    }
    
    /**
     * Get the building geometry information
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @returns {Object|null} - Building geometry information
     */
    getBuildingGeometry(feature) {
        try {
            // First try to get position from the feature's content
            if (feature._content) {
                const content = feature._content;
                const tile = content.tile;
                
                if (tile) {
                    // Get the tile's transform matrix
                    const transform = tile.computedTransform || tile.transform;
                    
                    if (transform) {
                        console.log('Using tile transform for building position');
                        
                        // Extract translation (position) from the transform matrix
                        const position = new Cesium.Cartesian3();
                        Cesium.Matrix4.getTranslation(transform, position);
                        
                        // Extract scale from the transform matrix
                        const scale = new Cesium.Cartesian3();
                        Cesium.Matrix4.getScale(transform, scale);
                        
                        // Convert position to cartographic (longitude, latitude, height)
                        const cartographic = Cesium.Cartographic.fromCartesian(position);
                        
                        // Use reasonable defaults for scale if the extracted values are too small
                        const finalWidth = scale.x > 10 ? scale.x : 60;
                        const finalLength = scale.y > 10 ? scale.y : 120;
                        const finalHeight = scale.z > 10 ? scale.z : 45;
                        
                        return {
                            position: position,
                            cartographic: cartographic,
                            dimensions: new Cesium.Cartesian3(
                                finalWidth,  // Width estimate based on scale
                                finalLength, // Length estimate based on scale
                                finalHeight  // Height from scale
                            ),
                            transform: transform
                        };
                    }
                }
            }
            
            // Fallback to using the selected building's bounding region
            // This gets the visual position of the selected building
            const boundingSphere = this.getSelectedBuildingBoundingSphere(feature);
            if (boundingSphere) {
                console.log('Using bounding sphere for building position');
                
                const position = boundingSphere.center;
                const cartographic = Cesium.Cartographic.fromCartesian(position);
                const radius = boundingSphere.radius;
                
                return {
                    position: position,
                    cartographic: cartographic,
                    dimensions: new Cesium.Cartesian3(
                        radius * 2, // Width
                        radius * 2, // Length
                        radius * 2  // Height
                    )
                };
            }
            
            // Last resort: use the camera position and fixed building coordinates
            console.log('Using camera-based position and fixed coordinates (fallback)');
            
            // Create a position at the Rotterdam coordinates specified
            const position = Cesium.Cartesian3.fromDegrees(4.54, 51.95, 40);
            const cartographic = Cesium.Cartographic.fromDegrees(4.54, 51.95, 40);
            
            return {
                position: position,
                cartographic: cartographic,
                dimensions: new Cesium.Cartesian3(60, 120, 45)  // Default dimensions from screenshot
            };
        } catch (error) {
            console.error('Error getting building geometry:', error);
            
            // Last resort fallback - hardcoded position from screenshot
            const position = Cesium.Cartesian3.fromDegrees(4.54, 51.95, 40);
            const cartographic = Cesium.Cartographic.fromDegrees(4.54, 51.95, 40);
            
            return {
                position: position,
                cartographic: cartographic,
                dimensions: new Cesium.Cartesian3(60, 120, 45)  // Default dimensions
            };
        }
    }
    
    /**
     * Get the bounding sphere of the selected building
     * @param {Cesium.Cesium3DTileFeature} feature - Building feature
     * @returns {Cesium.BoundingSphere|null} - Bounding sphere
     */
    getSelectedBuildingBoundingSphere(feature) {
        try {
            // Try different approaches to get the bounding sphere
            if (feature.content && feature.content.boundingSphere) {
                return feature.content.boundingSphere;
            }
            
            if (feature._content && feature._content.boundingSphere) {
                return feature._content.boundingSphere;
            }
            
            if (feature._content && feature._content.tile && feature._content.tile.boundingSphere) {
                return feature._content.tile.boundingSphere;
            }
            
            // Try to access the bounding region
            if (feature._content && feature._content.tile && feature._content.tile.boundingVolume) {
                const boundingVolume = feature._content.tile.boundingVolume;
                if (boundingVolume.sphere) {
                    return boundingVolume.sphere;
                }
                
                // Create a bounding sphere from a bounding region if available
                if (boundingVolume.region) {
                    const region = boundingVolume.region;
                    const centerLon = (region[0] + region[2]) / 2;
                    const centerLat = (region[1] + region[3]) / 2;
                    const centerHeight = (region[4] + region[5]) / 2;
                    const width = Cesium.Math.toDegrees(region[2] - region[0]) * 111000;
                    const height = Cesium.Math.toDegrees(region[3] - region[1]) * 111000;
                    const radius = Math.max(width, height) / 2;
                    
                    const center = Cesium.Cartesian3.fromRadians(centerLon, centerLat, centerHeight);
                    return new Cesium.BoundingSphere(center, radius);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error getting building bounding sphere:', error);
            return null;
        }
    }
    
    /**
     * Create floor entities for a building
     * @param {string} buildingId - Building ID
     * @param {Object} buildingData - Building data
     * @returns {boolean} - Success or failure
     */
    createFloorEntities(buildingId, buildingData) {
        try {
            const floorEntities = [];
            const totalFloors = buildingData.totalFloors;
            const floorHeight = buildingData.floorHeight;
            const buildingHeight = buildingData.height;
            
            console.log(`Creating ${totalFloors} floors with height ${floorHeight}m each`);
            
            // Add a debug marker for building center - this helps verify positioning
            if (this.debugMode) {
                const buildingCenter = buildingData.position.clone();
                this.addDebugMarker(buildingCenter, `Building ${buildingId} Center`);
                
                // Also add a debug marker at the ground level
                const groundPosition = Cesium.Cartesian3.fromRadians(
                    buildingData.cartographic.longitude,
                    buildingData.cartographic.latitude,
                    buildingData.cartographic.height - (buildingHeight / 2)
                );
                this.addDebugMarker(groundPosition, `Building ${buildingId} Ground`);
            }
            
            // Create each floor entity with a simpler, more reliable approach
            for (let floorNum = 0; floorNum < totalFloors; floorNum++) {
                // Use a simpler approach to positioning floors
                const relativeHeight = floorNum / totalFloors; // 0 to 1
                const absoluteHeight = buildingData.cartographic.height - (buildingHeight / 2) + (relativeHeight * buildingHeight);
                
                // Create a proper position for this floor
                const floorPosition = Cesium.Cartesian3.fromRadians(
                    buildingData.cartographic.longitude,
                    buildingData.cartographic.latitude,
                    absoluteHeight
                );
                
                // Log the calculation
                console.log(`Floor ${floorNum + 1}: relative height = ${relativeHeight}, absolute height = ${absoluteHeight}m`);
                
                // Find WOZ objects on this floor
                const wozObjectsOnFloor = buildingData.properties.filter(
                    prop => prop.bwlg_vb0 === floorNum
                );
                
                // Create floor entity using absolute positioning instead of relative
                const floorEntity = this.createSimpleFloorEntity(
                    buildingId,
                    floorNum,
                    floorPosition,
                    buildingData.dimensions,
                    floorHeight,
                    totalFloors,
                    wozObjectsOnFloor
                );
                
                if (floorEntity) {
                    // Add entity to viewer
                    this.viewer.entities.add(floorEntity);
                    floorEntities.push(floorEntity);
                    
                    // Add a debug marker for this floor
                    if (this.debugMode && (floorNum === 0 || floorNum === totalFloors - 1 || floorNum === Math.floor(totalFloors / 2))) {
                        this.addDebugMarker(floorPosition, `Floor ${floorNum + 1}`);
                    }
                }
            }
            
            // Store the entities for later management
            this.floorEntities.set(buildingId, floorEntities);
            
            return floorEntities.length > 0;
        } catch (error) {
            console.error('Error creating floor entities:', error);
            return false;
        }
    }
    
    /**
     * Create a single floor entity using simplified positioning
     * @param {string} buildingId - Building ID
     * @param {number} floorNum - Floor number
     * @param {Cesium.Cartesian3} position - Floor position
     * @param {Cesium.Cartesian3} dimensions - Building dimensions
     * @param {number} floorHeight - Height of each floor
     * @param {number} totalFloors - Total number of floors
     * @param {Array} wozObjects - WOZ objects on this floor
     * @returns {Cesium.Entity|null} - Floor entity
     */
    createSimpleFloorEntity(buildingId, floorNum, position, dimensions, floorHeight, totalFloors, wozObjects) {
        try {
            // Generate color based on floor number
            const color = this.getFloorColor(floorNum, totalFloors);
            
            // Create description HTML for the floor
            const description = this.createFloorDescription(floorNum, wozObjects);
            
            // Use a much larger scale for visibility
            const scaleFactor = 1.0; // Adjust this if needed for visibility
            
            // Create the floor entity
            const entity = new Cesium.Entity({
                id: `floor_${buildingId}_${floorNum}`,
                name: `Floor ${floorNum + 1}`,
                description: description,
                position: position,
                box: {
                    dimensions: new Cesium.Cartesian3(
                        dimensions.x * scaleFactor, 
                        dimensions.y * scaleFactor, 
                        floorHeight * 0.8 // Slightly smaller than actual floor height for separation
                    ),
                    material: color,
                    outline: true,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2.0
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
                    eyeOffset: new Cesium.Cartesian3(0, 0, -10),
                    showBackground: true,
                    backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8),
                    backgroundPadding: new Cesium.Cartesian2(7, 5),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                properties: {
                    buildingId: buildingId,
                    floorNumber: floorNum,
                    floorHeight: floorHeight,
                    wozObjects: wozObjects.length
                }
            });
            
            return entity;
        } catch (error) {
            console.error(`Error creating floor entity for floor ${floorNum}:`, error);
            return null;
        }
    }
    
    /**
     * Get color for a floor based on its position
     * @param {number} floorNum - Floor number
     * @param {number} totalFloors - Total floors in building
     * @returns {Cesium.Color} - Floor color
     */
    getFloorColor(floorNum, totalFloors) {
        if (floorNum === 0) {
            return Cesium.Color.RED.withAlpha(0.8); // Ground floor
        } else if (floorNum === totalFloors - 1) {
            return Cesium.Color.BLUE.withAlpha(0.8); // Top floor
        } else {
            // Generate colors from blue (bottom) to red (top)
            const normalizedHeight = floorNum / Math.max(1, totalFloors - 1);
            
            return Cesium.Color.fromHsl(
                0.6 - (normalizedHeight * 0.6), // Hue: blue (0.6) to red (0.0)
                0.8,                            // Saturation
                0.6,                            // Lightness
                0.8                             // Alpha
            );
        }
    }
    
    /**
     * Create HTML description for a floor
     * @param {number} floorNum - Floor number
     * @param {Array} wozObjects - WOZ objects on this floor
     * @returns {string} - HTML description
     */
    createFloorDescription(floorNum, wozObjects) {
        let description = `<h3>Floor ${floorNum + 1}</h3>`;
        
        if (wozObjects && wozObjects.length > 0) {
            description += `<p>This floor has ${wozObjects.length} properties:</p><ul>`;
            
            wozObjects.forEach((obj, index) => {
                if (index < 5) { // Limit to first 5 properties for performance
                    description += `<li>${obj.straat} ${obj.hnr}${obj.hltr || ''} (WOZ: ${obj.wozobjectnr})</li>`;
                }
            });
            
            if (wozObjects.length > 5) {
                description += `<li>...and ${wozObjects.length - 5} more properties</li>`;
            }
            
            description += '</ul>';
        } else {
            description += '<p>No WOZ objects found on this floor</p>';
        }
        
        return description;
    }
    
    /**
     * Add a debug marker at a position
     * @param {Cesium.Cartesian3} position - Position for the marker
     * @param {string} label - Label text
     */
    addDebugMarker(position, label) {
        const markerId = `debug_${label.replace(/\s+/g, '_')}`;
        
        // Remove any existing marker with this ID
        const existingMarker = this.viewer.entities.getById(markerId);
        if (existingMarker) {
            this.viewer.entities.remove(existingMarker);
        }
        
        // Add new marker with bright, highly visible style
        this.viewer.entities.add({
            id: markerId,
            position: position,
            point: {
                pixelSize: 20,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: label,
                font: '16px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                showBackground: true,
                backgroundColor: new Cesium.Color(0, 0, 0, 0.7)
            }
        });
    }
    
    /**
     * Remove floor models for a specific building
     * @param {string} buildingId - Building ID
     */
    removeFloorModels(buildingId) {
        // Store the building ID for debugging
        console.log(`Removing floor models for building ${buildingId}`);
        
        // Get the floor entities for this building
        const floorEntities = this.floorEntities.get(buildingId);
        
        if (floorEntities && floorEntities.length > 0) {
            // Remove all floor entities
            floorEntities.forEach(entity => {
                if (entity && this.viewer.entities.contains(entity)) {
                    this.viewer.entities.remove(entity);
                }
            });
            
            // Clear from map
            this.floorEntities.delete(buildingId);
            return true;
        } else {
            console.warn(`No floor entities found for building ${buildingId}`);
            return false;
        }
    }
    
    /**
     * Remove all floor models for all buildings
     */
    removeAllFloorModels() {
        console.log('Removing all floor models');
        
        // First try to remove entities individually - safer approach
        for (const [buildingId, entities] of this.floorEntities.entries()) {
            if (entities && entities.length > 0) {
                entities.forEach(entity => {
                    if (entity && this.viewer.entities.contains(entity)) {
                        this.viewer.entities.remove(entity);
                    }
                });
            }
        }
        
        // Clear tracking data
        this.floorEntities.clear();
        
        // Request a render to update the display
        this.viewer.scene.requestRender();
    }
    
    /**
     * Set visibility of floor models for a specific building
     * @param {string} buildingId - Building ID
     * @param {boolean} visible - Whether floor models should be visible
     */
    setFloorsVisible(buildingId, visible) {
        console.log(`Setting floor visibility for building ${buildingId} to ${visible}`);
        
        // Get the floor entities for this building
        const floorEntities = this.floorEntities.get(buildingId);
        
        if (floorEntities && floorEntities.length > 0) {
            console.log(`Found ${floorEntities.length} floor entities to modify`);
            
            // Set visibility for each floor entity without changing position
            floorEntities.forEach(entity => {
                if (entity && this.viewer.entities.contains(entity)) {
                    // Only update show property to preserve all other properties
                    entity.show = visible;
                    
                    // If entity has children (like label entities), also set those
                    if (entity.children && entity.children.length > 0) {
                        entity.children.forEach(child => {
                            if (child) child.show = visible;
                        });
                    }
                }
            });
            
            // Request a render to update the display
            this.viewer.scene.requestRender();
            return true;
        } else {
            console.warn(`No floor entities found for building ${buildingId}`);
            return false;
        }
    }
    
    /**
     * Destroy the generator and clean up resources
     */
    destroy() {
        this.removeAllFloorModels();
    }

    /**
     * Creates a complex-shaped floor entity for buildings with non-rectangular footprints
     * @param {string} buildingId - Building ID
     * @param {number} floorNum - Floor number
     * @param {Cesium.Cartesian3} position - Floor position
     * @param {Object} geometry - Building geometry
     * @param {number} floorHeight - Floor height
     * @param {Cesium.Color} color - Floor color
     * @param {Array} floorProperties - Properties for this floor
     * @param {Cesium.Quaternion} orientation - Orientation quaternion
     * @returns {Cesium.Entity} - Floor entity
     */
    createComplexShapeFloorEntity(buildingId, floorNum, position, geometry, floorHeight, color, floorProperties, orientation) {
        try {
            // Create description for this floor
            const description = this.createDetailedFloorDescription(floorNum, floorProperties, buildingId);
            
            // For building 0599100000035588 which is L-shaped
            if (buildingId === '0599100000035588') {
                // Calculate dimensions based on bounding sphere radius
                const baseSize = geometry.width * 1.2; // Adjust for visibility
                
                // Create parent entity to hold the floor info
                const parentEntity = new Cesium.Entity({
                    id: `floor_${buildingId}_${floorNum}`,
                    name: `Floor ${floorNum + 1}`,
                    description: description,
                    position: position,
                    orientation: orientation,
                    properties: {
                        buildingId: buildingId,
                        floorNumber: floorNum,
                        floorHeight: floorHeight,
                        unitsCount: floorProperties.length
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
                        pixelOffset: new Cesium.Cartesian2(baseSize / 2 + 10, 0),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8)
                    }
                });
                
                // Create main part of L (longer vertical segment)
                const mainPartEntity = new Cesium.Entity({
                    parent: parentEntity,
                    position: new Cesium.Cartesian3(
                        baseSize * 0.2, // Offset to the right 
                        0,              // Centered vertically
                        0               // No height offset (same as parent)
                    ),
                    box: {
                        dimensions: new Cesium.Cartesian3(
                            baseSize * 0.6, // Main part is 60% of total width
                            baseSize,       // Full length
                            floorHeight * 0.8 // Slightly shorter than full floor height
                        ),
                        material: color,
                        outline: true,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    }
                });
                
                // Create extension part of L (shorter horizontal segment)
                const extensionEntity = new Cesium.Entity({
                    parent: parentEntity,
                    position: new Cesium.Cartesian3(
                        0,                  // Centered horizontally
                        baseSize * -0.3,    // Offset downward to create L shape
                        0                   // No height offset (same as parent)
                    ),
                    box: {
                        dimensions: new Cesium.Cartesian3(
                            baseSize,        // Full width 
                            baseSize * 0.4,  // Extension is 40% of total length
                            floorHeight * 0.8 // Slightly shorter than full floor height
                        ),
                        material: color,
                        outline: true,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    }
                });
                
                // Add children to viewer
                this.viewer.entities.add(mainPartEntity);
                this.viewer.entities.add(extensionEntity);
                
                return parentEntity;
            }
            
            // For other buildings, fall back to regular box
            return this.createFloorEntityFromGeometry(
                buildingId, 
                floorNum, 
                position, 
                geometry, 
                floorHeight, 
                color, 
                floorProperties
            );
        } catch (error) {
            console.error('Error creating complex shape floor entity:', error);
            return null;
        }
    }

    /**
     * Add a debug building outline to visualize position
     * @param {string} buildingId - Building ID
     * @param {Object} geometry - Building geometry
     * @param {number} buildingHeight - Building height
     */
    addBuildingOutline(buildingId, geometry, buildingHeight) {
        try {
            // Create a transparent outline of the building to visualize alignment
            this.viewer.entities.add({
                id: `building_outline_${buildingId}`,
                position: geometry.position,
                orientation: geometry.orientationQuaternion,
                box: {
                    dimensions: new Cesium.Cartesian3(
                        geometry.width * 2,  // Match full building width
                        geometry.length * 2, // Match full building length
                        buildingHeight      // Match building height
                    ),
                    fill: false,
                    outline: true,
                    outlineColor: Cesium.Color.YELLOW.withAlpha(0.8),
                    outlineWidth: 3
                }
            });
        } catch (error) {
            console.warn('Error adding building outline:', error);
        }
    }
} 