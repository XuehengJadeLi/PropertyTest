/**
 * InfoPanel class to display building information
 */
export default class InfoPanel {
    constructor(containerId = 'infoPanel') {
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = containerId;
            this.container.className = 'info-panel';
            document.body.appendChild(this.container);
        }
        
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.allProperties = [];
        this.floorToggleCallback = null;
        
        this.createUI();
    }
    
    /**
     * Create the UI elements
     */
    createUI() {
        this.container.innerHTML = `
            <div class="info-panel-header">
                <h3>Building Information</h3>
                <button id="closeInfoPanel">×</button>
            </div>
            <div class="info-panel-content">
                <div id="buildingInfo">
                    <p>Click on a building to see its details</p>
                </div>
                <div id="buildingControls" class="building-controls"></div>
                <div id="propertiesList"></div>
                <div id="pagination" class="pagination"></div>
            </div>
        `;
        
        // Add close button functionality
        document.getElementById('closeInfoPanel').addEventListener('click', () => {
            this.hide();
        });
        
        // Initially hide the panel
        this.hide();
    }
    
    /**
     * Show the panel
     */
    show() {
        this.container.style.display = 'block';
    }
    
    /**
     * Hide the panel
     */
    hide() {
        this.container.style.display = 'none';
    }
    
    /**
     * Add button to toggle floor models
     * @param {boolean} initialState - Initial state of the toggle
     * @param {Function} callback - Function to call when toggled
     */
    addFloorToggleButton(initialState, callback) {
        this.floorToggleCallback = callback;
        
        const controlsContainer = document.getElementById('buildingControls');
        if (!controlsContainer) return;
        
        controlsContainer.innerHTML = `
            <div class="control-group">
                <button id="toggleFloors" class="control-button ${initialState ? 'active' : ''}">
                    ${initialState ? 'Hide Floors' : 'Show Floors'}
                </button>
            </div>
        `;
        
        document.getElementById('toggleFloors').addEventListener('click', () => {
            const isCurrentlyActive = document.getElementById('toggleFloors').classList.contains('active');
            const newState = !isCurrentlyActive;
            
            if (this.floorToggleCallback) {
                this.floorToggleCallback(newState);
            }
        });
    }
    
    /**
     * Update the floor toggle button state
     * @param {boolean} active - Whether the button should be active
     */
    updateFloorToggleButton(active) {
        const button = document.getElementById('toggleFloors');
        if (!button) return;
        
        if (active) {
            button.classList.add('active');
            button.textContent = 'Hide Floors';
        } else {
            button.classList.remove('active');
            button.textContent = 'Show Floors';
        }
    }
    
    /**
     * Display property information
     * @param {Array} properties - Array of WOZ objects
     */
    displayProperties(properties) {
        if (!properties || properties.length === 0) {
            this.showError('No information available for this building');
            return;
        }
        
        // Store all properties for pagination
        this.allProperties = properties;
        this.currentPage = 1;
        
        const buildingInfoElement = document.getElementById('buildingInfo');
        
        // Group by common properties (like building year, type, etc.)
        const firstProperty = properties[0];
        const pandid = firstProperty.pandid;
        const totalUnits = properties.length;
        
        // Determine building floors
        let lowestFloor = Infinity;
        let highestFloor = -Infinity;
        let constructionYear = firstProperty.bwjr;
        let totalFloors = firstProperty.aant_bwlg_pnd;
        
        properties.forEach(prop => {
            // Update floor information from all units
            if (prop.laagste_bwlg_pnd < lowestFloor) lowestFloor = prop.laagste_bwlg_pnd;
            if (prop.hoogste_bwlg_pnd > highestFloor) highestFloor = prop.hoogste_bwlg_pnd;
            
            // Use the most common construction year
            constructionYear = prop.bwjr || constructionYear;
            
            // Get total floors
            totalFloors = prop.aant_bwlg_pnd || totalFloors;
        });
        
        // Create HTML content for building information
        let html = `
            <h4>Building ID: ${pandid}</h4>
            <p>Address: ${firstProperty.straat}</p>
            <p>Construction Year: ${constructionYear}</p>
            <p>Number of Units: ${totalUnits}</p>
            <p>Building Type: ${firstProperty.woz_gebruikscode_oms}</p>
            <p>Floors: ${lowestFloor !== Infinity ? lowestFloor : 0} to ${highestFloor !== -Infinity ? highestFloor : 0}</p>
            <p>Total Floors: ${totalFloors}</p>
            <h4>Units in this Building:</h4>
        `;
        
        buildingInfoElement.innerHTML = html;
        
        // Display the first page of properties
        this.displayPropertiesPage();
        
        this.show();
    }
    
    /**
     * Display a page of properties
     */
    displayPropertiesPage() {
        const propertiesListElement = document.getElementById('propertiesList');
        const paginationElement = document.getElementById('pagination');
        
        // Calculate page information
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.allProperties.length);
        const totalPages = Math.ceil(this.allProperties.length / this.itemsPerPage);
        
        // Create the properties list HTML
        let propertiesHtml = `<div class="properties-info">Showing ${startIndex + 1} - ${endIndex} of ${this.allProperties.length} units</div>`;
        propertiesHtml += '<div class="property-list">';
        
        // Add list of individual properties for this page
        for (let i = startIndex; i < endIndex; i++) {
            const prop = this.allProperties[i];
            propertiesHtml += `
                <div class="property-item">
                    <h5>WOZ Object: ${prop.wozobjectnr}</h5>
                    <p>Address: ${prop.straat} ${prop.hnr}${prop.hltr ? prop.hltr : ''}</p>
                    <p>Postal Code: ${prop.pstc}</p>
                    <p>Floor: ${prop.bwlg_vb0}</p>
                    <p>Usage: ${prop.bag_gebruiksdoel} (${prop.woz_gebruikscode_oms})</p>
                </div>
            `;
        }
        
        propertiesHtml += '</div>';
        propertiesListElement.innerHTML = propertiesHtml;
        
        // Create pagination HTML
        let paginationHtml = '<div class="pagination-controls">';
        
        // Previous button
        paginationHtml += `<button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="prev">Previous</button>`;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Next button
        paginationHtml += `<button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="next">Next</button>`;
        
        paginationHtml += '</div>';
        paginationElement.innerHTML = paginationHtml;
        
        // Add pagination event listeners
        const pageBtns = paginationElement.querySelectorAll('.page-btn');
        pageBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                
                if (page === 'prev') {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                    }
                } else if (page === 'next') {
                    if (this.currentPage < totalPages) {
                        this.currentPage++;
                    }
                } else {
                    this.currentPage = parseInt(page);
                }
                
                this.displayPropertiesPage();
            });
        });
    }
    
    /**
     * Show an error message
     * @param {string} message - The error message
     */
    showError(message) {
        const buildingInfoElement = document.getElementById('buildingInfo');
        buildingInfoElement.innerHTML = `<p class="error">${message}</p>`;
        
        // Clear properties list and pagination
        document.getElementById('propertiesList').innerHTML = '';
        document.getElementById('pagination').innerHTML = '';
        document.getElementById('buildingControls').innerHTML = '';
        
        this.show();
    }
} 