import * as Cesium from "cesium";
import chroma from "chroma-js";

import { roofType, terrainHeight } from "./SymbolConditions.js";

export default class TileStyleManager {
  constructor(tileSetCityGml, tileSetPointCloud) {
    this.tileSetCityGml = tileSetCityGml;
    this.tileSetPointCloud = tileSetPointCloud;
    this.buildingDataLoader = null;
    this.buildingsWithInfo = new Set(); // Store buildings that have information
    this.databaseBuildingIds = new Set(); // Store building IDs from the database
  }

  setBuildingDataLoader(buildingDataLoader) {
    this.buildingDataLoader = buildingDataLoader;
  }

  /**
   * Set the list of building IDs from the database
   * @param {Array<string>} buildingIds - Array of building IDs from the database
   */
  setDatabaseBuildingIds(buildingIds) {
    this.databaseBuildingIds = new Set(buildingIds);
    console.log(`Loaded ${this.databaseBuildingIds.size} building IDs from database for styling`);
  }

  /**
   * Check if a building ID exists in the database
   * @param {string} buildingId - The building ID to check
   * @returns {boolean} - True if the building ID exists in the database
   */
  hasBuildingInDatabase(buildingId) {
    return this.databaseBuildingIds.has(buildingId);
  }

  // Add a method to mark a building as having information
  markBuildingHasInfo(buildingId) {
    if (buildingId) {
      this.buildingsWithInfo.add(buildingId);
    }
  }

  // Check if a building has information
  hasBuildingInfo(buildingId) {
    return this.buildingsWithInfo.has(buildingId);
  }

  applyStyle = (tileSet, conditions, show = "true") => {
    tileSet.style = new Cesium.Cesium3DTileStyle({
      color: {
        conditions: conditions,
      },
      show: show,
    });
  };

  generateColors = (numColors) => {
    return chroma.scale("Spectral").mode("lab").colors(numColors);
  };

  terrainHeightStyle = () => {
    const numConditions = terrainHeight.conditions.length;
    const colors = this.generateColors(numConditions);

    const colorConditions = terrainHeight.conditions.map((condition, index) => [
      "${TerrainHeight} > " + condition.value,
      "color('" + colors[index] + "')",
    ]);

    colorConditions.push(["true", "color('" + colors[numConditions] + "')"]);
    this.applyStyle(this.tileSetCityGml, colorConditions);
  };

  roofTypeStyle = () => {
    const numConditions = roofType.conditions.length;
    const colors = this.generateColors(numConditions);

    const colorConditions = roofType.conditions.map((condition, index) => [
      "Number(${RoofType}) === " + condition.value,
      "color('" + colors[index] + "')",
    ]);

    colorConditions.push(["true", "color('" + colors[numConditions] + "')"]);
    this.applyStyle(this.tileSetCityGml, colorConditions);
  };

  /**
   * Check if a building ID exists in the dataset
   * @param {string} buildingId - The building ID to check
   * @returns {boolean} - True if the building ID exists in the dataset
   */
  hasBuildingData(buildingId) {
    if (!this.buildingDataLoader || !this.buildingDataLoader.loaded) {
      console.warn('Building data not loaded for checking if building has data');
      return false;
    }
    
    if (!buildingId) {
      return false;
    }
    
    return this.buildingDataLoader.hasBuildingId(buildingId);
  }

  // Color buildings that don't have database entries in gray
  applyDatabaseFilterStyle() {
    if (this.databaseBuildingIds.size === 0) {
      console.warn("No database building IDs loaded, applying default white style");
      
      // Apply simple white style if no database IDs loaded
      const colorConditions = [
        ["true", "color('white', 0.7)"]
      ];
      
      this.applyStyle(this.tileSetCityGml, colorConditions);
      return;
    }
    
    console.log(`Applying database filter style (${this.databaseBuildingIds.size} buildings in database)`);
    
    // Create a reference that can be accessed inside the style function
    const that = this;
    
    // Apply style to the tileset
    this.tileSetCityGml.style = new Cesium.Cesium3DTileStyle({
      color: {
        evaluateColor: function(feature, result) {
          // Try to get the building ID from feature properties
          let buildingId = null;
          
          // Search for building ID in various property names
          if (feature && feature.getPropertyNames) {
            const propertyNames = feature.getPropertyNames();
            
            for (const propName of propertyNames) {
              const value = feature.getProperty(propName);
              
              // If it looks like a PANDID (16 digits) or contains a PANDID pattern, extract it
              if (typeof value === 'string') {
                // Direct match for 16-digit number
                if (value.match(/^[0-9]{16}$/)) {
                  buildingId = value;
                  break;
                }
                
                // Try to extract PANDID from longer strings using regex
                const match = value.match(/([0-9]{16})/);
                if (match && match[1]) {
                  buildingId = match[1];
                  break;
                }
              }
            }
          }
          
          // Default color (white) for buildings in database
          const inDatabaseColor = Cesium.Color.WHITE.withAlpha(0.7);
          
          // Gray color for buildings not in database
          const notInDatabaseColor = Cesium.Color.GRAY.withAlpha(0.5);
          
          // If no building ID found, use default color (white)
          if (!buildingId) {
            return Cesium.Color.clone(inDatabaseColor, result);
          }
          
          // Check if building ID exists in the database
          const inDatabase = that.databaseBuildingIds.has(buildingId);
          
          // Set color based on whether building is in database
          if (inDatabase) {
            return Cesium.Color.clone(inDatabaseColor, result);
          } else {
            return Cesium.Color.clone(notInDatabaseColor, result);
          }
        }
      }
    });
  }

  // Add a new style method to color buildings based on whether they exist in the dataset
  datasetStyle = () => {
    if (!this.buildingDataLoader || !this.buildingDataLoader.loaded) {
      console.warn("Building data not loaded, applying default white style");
      
      // Apply simple white style if data not loaded
      const colorConditions = [
        ["true", "color('white', 0.7)"]
      ];
      
      this.applyStyle(this.tileSetCityGml, colorConditions);
      return;
    }
    
    console.log("Applying dataset-based style");
    
    // Define the style conditions
    // Buildings in the dataset will use normal coloring (white)
    // Buildings not in the dataset will be gray
    const colorConditions = [
      // Check if building ID is in the dataset
      // Note: This relies on the building ID property being available in the 3D tileset
      // The property name might need adjustment based on your actual data
      [
        "regExp('${PANDID}').test('.*') && " + 
        `Number(regExp('${PANDID}').exec('${PANDID}')[0] in this.buildingIds)`,
        "color('white', 0.7)"
      ],
      // Buildings not in dataset will be gray
      ["true", "color('gray', 0.5)"]
    ];
    
    // Create a JavaScript function to be used in the style
    const styleFunction = new Function('buildingIds', `
      return new Cesium.Cesium3DTileStyle({
        color: {
          conditions: [
            ["${feature.PANDID} !== null && ${feature.PANDID} !== undefined", "color('white', 0.7)"],
            ["true", "color('gray', 0.5)"]
          ]
        }
      });
    `);
    
    // Create and apply the style
    this.tileSetCityGml.style = new Cesium.Cesium3DTileStyle({
      defines: {
        buildingInDataset: "${Number(regExp('${PANDID}').exec('${PANDID}')[0] in buildingIds)}"
      },
      color: "buildingInDataset ? color('white', 0.7) : color('gray', 0.5)"
    });
  };

  pointCloudStyle = () => {
    const colorCondition = [
      ["${Classification} === 1", "color('green')"],
      ["${Classification} === 9", "color('lightblue')"],
    ];
    const showQuery =
      "${feature['Classification'] === 1} || ${feature['Classification'] === 9}";
    this.applyStyle(this.tileSetPointCloud, colorCondition, showQuery);
  };
  
  // Function to get building IDs from properties
  getFeatureBuildingId(feature) {
    if (!feature) return null;
    
    // Try various property names that might contain the building ID
    for (const propName of ['PANDID', 'pandid', 'id', 'ID', 'buildingId', 'gml:id']) {
      if (feature.hasProperty && feature.hasProperty(propName)) {
        const value = feature.getProperty(propName);
        
        // If it looks like a PANDID (16 digits), use it
        if (typeof value === 'string' && value.match(/^[0-9]{16}$/)) {
          return value;
        }
      }
    }
    
    return null;
  }
  
  // Fixed approach for coloring buildings based on a filter function
  applyBuildingFilter() {
    if (!this.buildingDataLoader || !this.buildingDataLoader.loaded) {
      console.warn("Building data not loaded, cannot apply building filter");
      return;
    }

    console.log("Applying building filter to color buildings based on dataset presence");

    // Get the list of building IDs from the dataset
    const buildingIds = this.buildingDataLoader.getAllBuildingIds();
    console.log(`Using ${buildingIds.size} building IDs from dataset for filtering`);

    // Colors
    const inDatasetColor = Cesium.Color.WHITE.withAlpha(0.9);
    const notInDatasetColor = Cesium.Color.GRAY.withAlpha(0.6);

    const that = this;

    // Gather every non-null tileset so we style all of them (cityGML1, cityGML2, point cloud, …)
    const targetTileSets = [this.tileSetCityGml, this.tileSetPointCloud].filter(ts => ts);

    if (targetTileSets.length === 0) {
      console.warn("No valid tilesets available to style");
      return;
    }

    targetTileSets.forEach(ts => {
      ts.style = new Cesium.Cesium3DTileStyle({
        color: {
          evaluateColor: function(feature, result) {
            // Try to extract a 16-digit PANDID from any property (string OR numeric)
            let buildingId = null;

            if (feature && feature.getPropertyNames) {
              const props = feature.getPropertyNames();
              for (const name of props) {
                const value = feature.getProperty(name);
                if (value === undefined || value === null) continue;

                const valueStr = String(value);

                // Exact 16-digit string
                if (/^[0-9]{16}$/.test(valueStr)) {
                  buildingId = valueStr;
                  break;
                }

                // Embedded 16-digit pattern
                const match = valueStr.match(/([0-9]{16})/);
                if (match && match[1]) {
                  buildingId = match[1];
                  break;
                }
              }
            }

            // Decide colour
            if (buildingId && that.buildingDataLoader.hasBuildingId(buildingId)) {
              return Cesium.Color.clone(inDatasetColor, result);
            }
            return Cesium.Color.clone(notInDatasetColor, result);
          }
        }
      });
    });
  }

  // Color buildings that don't have information in gray
  applyNoInfoBuildingStyle() {
    console.log(`Applying style based on building info (${this.buildingsWithInfo.size} buildings with info)`);
    
    // Create a reference that can be accessed inside the style function
    const that = this;
    
    // Apply style to the tileset
    this.tileSetCityGml.style = new Cesium.Cesium3DTileStyle({
      color: {
        evaluateColor: function(feature, result) {
          // Try to get the building ID from feature properties
          let buildingId = null;
          
          // Search for building ID in various property names
          if (feature && feature.getPropertyNames) {
            const propertyNames = feature.getPropertyNames();
            
            for (const propName of propertyNames) {
              const value = feature.getProperty(propName);
              
              // If it looks like a PANDID (16 digits) or contains a PANDID pattern, extract it
              if (typeof value === 'string') {
                // Direct match for 16-digit number
                if (value.match(/^[0-9]{16}$/)) {
                  buildingId = value;
                  break;
                }
                
                // Try to extract PANDID from longer strings using regex
                const match = value.match(/([0-9]{16})/);
                if (match && match[1]) {
                  buildingId = match[1];
                  break;
                }
              }
            }
          }
          
          // Default color (white) for buildings with info
          const hasInfoColor = Cesium.Color.WHITE.withAlpha(0.7);
          
          // Gray color for buildings without info
          const noInfoColor = Cesium.Color.GRAY.withAlpha(0.5);
          
          // If no building ID found, use gray color
          if (!buildingId) {
            return Cesium.Color.clone(noInfoColor, result);
          }
          
          // Check if building has information
          const hasInfo = that.buildingsWithInfo.has(buildingId);
          
          // Set color based on whether building has information
          if (hasInfo) {
            return Cesium.Color.clone(hasInfoColor, result);
          } else {
            return Cesium.Color.clone(noInfoColor, result);
          }
        }
      }
    });
  }
}