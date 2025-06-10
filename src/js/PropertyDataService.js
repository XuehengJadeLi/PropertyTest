/**
 * Service to handle property data fetching and caching
 */
export default class PropertyDataService {
    constructor(apiUrl = 'http://localhost:3000/api') {
        this.apiUrl = apiUrl;
        this.cache = new Map();
        this.databaseBuildingIds = null; // Cache of database building IDs
        console.log(`PropertyDataService initialized with API URL: ${this.apiUrl}`);
        
        // Test the API connection on initialization
        this.testConnection();
    }

    /**
     * Test the API connection
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/status`);
            if (response.ok) {
                const data = await response.json();
                console.log('API connection successful:', data);
            } else {
                console.warn(`API status check failed: ${response.status}`);
            }
        } catch (error) {
            console.error('API connection test failed:', error);
        }
    }

    /**
     * Get property data for a building by PANDID
     * @param {string} pandId - The PANDID of the building
     * @returns {Promise<Array>} - Array of WOZ objects associated with the building
     */
    async getPropertiesByPandId(pandId) {
        if (!pandId) {
            throw new Error('PANDID is required');
        }

        console.log(`Fetching properties for PANDID: ${pandId}`);

        // Check cache first
        if (this.cache.has(pandId)) {
            console.log(`Using cached data for PANDID: ${pandId}`);
            return this.cache.get(pandId);
        }

        try {
            const url = `${this.apiUrl}/woz/${pandId}`;
            console.log(`Fetching from URL: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`HTTP error ${response.status} for PANDID: ${pandId}`);
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log(`Received ${data.length} properties for PANDID: ${pandId}`);
            
            // Cache the result (even if it's an empty array)
            this.cache.set(pandId, data);
            
            return data;
        } catch (error) {
            console.error('Error fetching property data:', error);
            throw error;
        }
    }

    /**
     * Get all available PANDIDs from the API
     * @returns {Promise<Array<string>>} - Array of PANDIDs
     */
    async getAllPandIds() {
        try {
            console.log('Fetching all PANDIDs from API');
            
            // If we already have the cached IDs, use them
            if (this.databaseBuildingIds) {
                console.log(`Using cached ${this.databaseBuildingIds.length} PANDIDs`);
                return this.databaseBuildingIds;
            }
            
            const response = await fetch(`${this.apiUrl}/pandids`);
            
            if (!response.ok) {
                console.error(`HTTP error ${response.status} fetching PANDIDs`);
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Received ${data.length} PANDIDs from API`);
            
            // Cache the results for future use
            this.databaseBuildingIds = data;
            
            return data;
        } catch (error) {
            console.error('Error fetching PANDIDs:', error);
            
            // Return an empty array on error
            return [];
        }
    }
    
    /**
     * Check if a building ID exists in the database
     * @param {string} pandId - Building ID to check
     * @returns {Promise<boolean>} - True if the building exists in the database
     */
    async buildingExistsInDatabase(pandId) {
        if (!pandId) return false;
        
        try {
            // Load all building IDs if not already loaded
            if (!this.databaseBuildingIds) {
                await this.getAllPandIds();
            }
            
            // Check if the building ID exists in our cached list
            return this.databaseBuildingIds.includes(pandId);
        } catch (error) {
            console.error('Error checking if building exists in database:', error);
            return false;
        }
    }
    
    /**
     * Create mock data for a building (for demo purposes)
     * @param {string} pandId - The PANDID of the building
     * @returns {Array} - Mocked WOZ objects
     */
    createMockData(pandId) {
        console.log(`Creating mock data for PANDID: ${pandId}`);
        
        // Create 5 mock properties for this building
        const mockData = [];
        
        for (let i = 0; i < 5; i++) {
            mockData.push({
                id: i + 1,
                wozobjectnr: `MOCK${i+1}-${pandId.substring(0, 6)}`,
                pandid: pandId,
                straat: 'Mock Street',
                hnr: `${100 + i}`,
                pstc: '3069EK',
                bwjr: 1973, // From the screenshot
                bag_gebruiksdoel: 'woonfunctie',
                woz_gebruikscode: '1181',
                woz_gebruikscode_oms: 'Galerijflat',
                bwlg_vb0: i + 1,
                laagste_bwlg_pnd: 0,
                hoogste_bwlg_pnd: 8,
                aant_bwlg_pnd: 9
            });
        }
        
        return mockData;
    }
} 