# Rotterdam Property Valuation Viewer

This application combines a 3D CityGML model of Rotterdam with WOZ property data, allowing users to click on buildings and view detailed property information.

## Features

- Interactive 3D visualization of Rotterdam using Cesium
- PostgreSQL database for storing WOZ property information
- Building selection and highlighting
- Property information display for each building
- Support for multiple WOZ objects per building

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- Cesium Ion account with Rotterdam CityGML models uploaded

### Quick Setup

The easiest way to set up the application is to use the provided setup script:

1. Install dependencies:
```bash
npm install
```

2. Run the setup script:
```bash
npm run setup
```

3. Follow the prompts to configure your PostgreSQL connection.

4. Complete the remaining steps shown in the setup script output.

### Manual Setup

If you prefer to set up manually:

1. Install dependencies:
```bash
npm install
```

2. Update the database connection settings in `src/js/import_data.js` and `src/server.js` with your PostgreSQL credentials.

3. Create the PostgreSQL database:
```bash
psql -U postgres -f src/js/database.sql
```

4. The application will automatically use the existing `BAGWOZ_DATASET.txt` file in the project root directory.

5. Import the data:
```bash
npm run import
```

6. Start the server:
```bash
npm start
```

7. Open your browser and navigate to `http://localhost:3000`

## Usage

1. The application displays a 3D model of Rotterdam with buildings
2. Click on any building to see information about all WOZ objects (properties) within that building
3. The info panel shows details including:
   - Building ID
   - Address
   - Construction year
   - Number of units
   - Building type
   - Floor information
   - Individual property details

## Architecture

The application consists of:

1. **Frontend**: Cesium-based 3D viewer with custom building selection and information display
2. **Backend**: Express.js server providing API endpoints
3. **Database**: PostgreSQL storing WOZ property data

## Data Structure

The WOZ data includes:
- WOZOBJECTNR: Unique identifier for each property object
- PANDID: Building identifier that links properties to buildings in the 3D model
- Address information (street, number, postal code)
- Building information (construction year, usage type, number of floors)

## Mapping Buildings to Data

The application uses the PANDID field to link 3D building models with their corresponding property data in the database. This requires either:

1. Your 3D tileset to include PANDID properties
2. A mapping between the 3D model feature IDs and PANDIDs

## License

This project is licensed under the MIT License - see the LICENSE file for details. 