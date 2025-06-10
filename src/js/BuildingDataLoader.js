/**
 * BuildingDataLoader class to load building IDs from a text file
 */
export default class BuildingDataLoader {
  constructor() {
    this.buildingIds = new Set();
    this.loaded = false;
    this.filePath = null;
  }

  /**
   * Load building IDs from the text file
   * @param {string} filePath - Path to the text file containing building IDs
   * @returns {Promise<boolean>} - True if loading was successful
   */
  async loadBuildingIdsFromFile(filePath = 'BAGWOZ_DATASET.txt') {
    try {
      this.filePath = filePath;
      console.log(`Loading building IDs from file: ${filePath}`);
      
      // Make sure the file path is properly encoded for the API call
      const encodedPath = encodeURIComponent(filePath.replace(/\\/g, '/'));
      const apiUrl = `/api/buildingIds?filePath=${encodedPath}`;
      
      console.log(`Fetching from API URL: ${apiUrl}`);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`Failed to load building IDs: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data.buildingIds)) {
        this.buildingIds = new Set(data.buildingIds);
        this.loaded = true;
        console.log(`Successfully loaded ${this.buildingIds.size} building IDs from ${filePath}`);
        
        // Log a sample of building IDs for debugging
        const sampleIds = Array.from(this.buildingIds).slice(0, 5);
        console.log("Sample building IDs:", sampleIds);
        
        return true;
      } else {
        console.error('Invalid data format received:', data);
        return false;
      }
    } catch (error) {
      console.error('Error loading building IDs:', error);
      return false;
    }
  }

  /**
   * Check if a building ID exists in the loaded set
   * @param {string} buildingId - The building ID to check
   * @returns {boolean} - True if the building ID exists
   */
  hasBuildingId(buildingId) {
    if (!this.loaded) {
      console.warn('Building IDs not loaded yet');
      return true; // Default to true if not loaded
    }
    
    if (!buildingId) {
      return false;
    }
    
    // Ensure the building ID is a trimmed string
    const id = String(buildingId).trim();
    
    // For debugging
    if (id && this.buildingIds.has(id)) {
      console.log(`Building ID ${id} found in dataset`);
    }
    
    return this.buildingIds.has(id);
  }
  
  /**
   * Get all loaded building IDs
   * @returns {Set<string>} - Set of building IDs
   */
  getAllBuildingIds() {
    return this.buildingIds;
  }
} 