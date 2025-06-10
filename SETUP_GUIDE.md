# Rotterdam Property Valuation Setup Guide

This guide will help you set up and run the Rotterdam Property Valuation application.

## Setup Steps

### 1. Create the Database

Run the following command to create the PostgreSQL database and tables:

```bash
npm run create-db
```

This will create:
- The `rotterdam_property_data` database
- The `woz_objects` table to store property data
- An index on the `pandid` column for faster queries

### 2. Import WOZ Data

After the database is created, import the WOZ property data:

```bash
npm run import
```

This will read the `BAGWOZ_DATASET.txt` file and import all property records into the database. The import process may take a few minutes depending on the size of your dataset.

### 3. Start the Application

Once the data is imported, start the application:

```bash
npm start
```

You can now access the application at http://localhost:3000

## Using the Application

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

## Troubleshooting

### Connection Issues

If you encounter database connection issues:

1. Verify PostgreSQL is running
2. Check that the database credentials in the files match your PostgreSQL setup:
   - src/js/create_database.js
   - src/js/import_data.js
   - src/server.js

### Import Issues

If the import fails:

1. Check that the `BAGWOZ_DATASET.txt` file exists in the project root directory
2. Verify the file format matches the expected format (semicolon-separated values)
3. Ensure the database and table were created successfully

For further assistance, refer to the README.md file or check the console logs for error messages. 