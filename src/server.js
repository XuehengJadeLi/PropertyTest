const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rotterdam_property_data',
  password: '123456',
  port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve webpack build from dist directory first
app.use(express.static(path.join(__dirname, '../dist')));

// Then serve other static files from src directory
app.use(express.static(path.join(__dirname, '..')));

// Root route - serve the HTML file from dist
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Debug route - serve the debug HTML file
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

// Debug route to check if server is responding
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cesiumPath: path.resolve(__dirname, '../node_modules/cesium')
    }
  });
});

// Checked building IDs cache to avoid re-scanning the file
const checkedBuildingIds = new Set();
const buildingsWithData = new Set();

// Function to check if a building ID exists in the dataset without loading all records
async function buildingExistsInDataset(pandid) {
  // If already checked, return from cache
  if (checkedBuildingIds.has(pandid)) {
    return buildingsWithData.has(pandid);
  }
  
  const dataFilePath = path.resolve(__dirname, '../BAGWOZ_DATASET.txt');
  
  if (!fs.existsSync(dataFilePath)) {
    return false;
  }
  
  try {
    const fileStream = fs.createReadStream(dataFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    let exists = false;
    
    for await (const line of rl) {
      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      // Parse the CSV line
      const values = line.split(';');
      
      // Check if this line contains the requested PANDID
      if (values.length >= 6 && values[5] === pandid) {
        exists = true;
        break;
      }
    }
    
    // Add to cache
    checkedBuildingIds.add(pandid);
    if (exists) {
      buildingsWithData.add(pandid);
    }
    
    return exists;
  } catch (error) {
    console.error('Error checking building existence:', error);
    return false;
  }
}

// API endpoint to get WOZ objects by PANDID
app.get('/api/woz/:pandid', async (req, res) => {
  try {
    const { pandid } = req.params;
    
    console.log(`API request for PANDID: ${pandid}`);
    
    // First check if this building exists in the dataset
    const exists = await buildingExistsInDataset(pandid);
    
    if (!exists) {
      console.log(`No data found for PANDID: ${pandid} - returning empty array`);
      return res.json([]);
    }
    
    // Try to get real data from the database
    const result = await pool.query(
      'SELECT * FROM woz_objects WHERE pandid = $1',
      [pandid]
    );
    
    console.log(`Found ${result.rowCount} records in database for PANDID: ${pandid}`);
    
    // If records found in database, return them
    if (result.rowCount > 0) {
      return res.json(result.rows);
    }
    
    // If no records in database but building exists in dataset, read from file
    const dataFilePath = path.resolve(__dirname, '../BAGWOZ_DATASET.txt');
    const matchingRecords = [];
    
    // Create file reader
    const fileStream = fs.createReadStream(dataFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    
    for await (const line of rl) {
      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      // Parse the CSV line
      const values = line.split(';');
      
      // Check if this line contains the requested PANDID
      if (values.length >= 6 && values[5] === pandid) {
        const [
          wozobjectnr, straat, hnr, hltr, pstc, pandid, 
          vboid, numid, bwjr, bag_gebruiksdoel, 
          woz_gebruikscode, woz_gebruikscode_oms, 
          bwlg_vb0, laagste_bwlg_pnd, hoogste_bwlg_pnd, aant_bwlg_pnd
        ] = values;
        
        matchingRecords.push({
          wozobjectnr, 
          straat, 
          hnr, 
          hltr, 
          pstc, 
          pandid, 
          vboid, 
          numid, 
          bwjr: parseInt(bwjr) || null,
          bag_gebruiksdoel, 
          woz_gebruikscode, 
          woz_gebruikscode_oms, 
          bwlg_vb0: parseInt(bwlg_vb0) || null,
          laagste_bwlg_pnd: parseInt(laagste_bwlg_pnd) || null,
          hoogste_bwlg_pnd: parseInt(hoogste_bwlg_pnd) || null,
          aant_bwlg_pnd: parseInt(aant_bwlg_pnd) || null
        });
      }
    }
    
    console.log(`Found ${matchingRecords.length} records from text file for PANDID: ${pandid}`);
    res.json(matchingRecords);
    
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

// API endpoint to get all unique PANDIDs
app.get('/api/pandids', async (req, res) => {
  try {
    // Try to get PANDIDs from database first
    const result = await pool.query(
      'SELECT DISTINCT pandid FROM woz_objects'
    );
    
    if (result.rowCount > 0) {
      return res.json(result.rows.map(row => row.pandid));
    }
    
    // If no PANDIDs in database, try to get them from the file
    const dataFilePath = path.resolve(__dirname, '../BAGWOZ_DATASET.txt');
    
    if (!fs.existsSync(dataFilePath)) {
      return res.json([]);
    }
    
    const uniquePandIds = new Set();
    
    const fileStream = fs.createReadStream(dataFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    
    for await (const line of rl) {
      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      // Parse the CSV line
      const values = line.split(';');
      
      // Extract PANDID (index 5)
      if (values.length >= 6) {
        const pandid = values[5];
        if (pandid) {
          uniquePandIds.add(pandid);
        }
      }
    }
    
    console.log(`Found ${uniquePandIds.size} unique PANDIDs from file`);
    return res.json(Array.from(uniquePandIds));
    
  } catch (error) {
    console.error('Error fetching PANDIDs:', error);
    res.status(500).json({ error: 'Error fetching PANDIDs' });
  }
});

// API endpoint to get all building IDs from a specific file
app.get('/api/buildingIds', async (req, res) => {
  try {
    const { filePath } = req.query;
    let dataFilePath;
    
    if (filePath) {
      // If a specific file path is provided, use it (but ensure it's safe)
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      // Check if path is absolute, otherwise resolve relative to app root
      if (path.isAbsolute(normalizedPath)) {
        dataFilePath = normalizedPath;
      } else {
        dataFilePath = path.resolve(__dirname, '..', normalizedPath);
      }
    } else {
      // Default to the BAGWOZ_DATASET.txt file
      dataFilePath = path.resolve(__dirname, '../BAGWOZ_DATASET.txt');
    }
    
    // Check if file exists
    if (!fs.existsSync(dataFilePath)) {
      console.error(`File not found: ${dataFilePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log(`Reading building IDs from file: ${dataFilePath}`);
    
    // Read the file and extract all building IDs
    const uniqueBuildingIds = new Set();
    
    const fileStream = fs.createReadStream(dataFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    let lineCount = 0;
    
    for await (const line of rl) {
      lineCount++;
      
      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      // Parse the CSV line
      const values = line.split(';');
      
      // Extract PANDID (index 5)
      if (values.length >= 6) {
        const pandid = values[5];
        if (pandid && pandid.trim()) {
          uniqueBuildingIds.add(pandid.trim());
        }
      }
    }
    
    console.log(`Read ${lineCount} lines, found ${uniqueBuildingIds.size} unique building IDs`);
    
    // Return the unique building IDs as an array
    return res.json({ 
      buildingIds: Array.from(uniqueBuildingIds),
      count: uniqueBuildingIds.size,
      filePath: dataFilePath
    });
    
  } catch (error) {
    console.error('Error reading building IDs:', error);
    res.status(500).json({ error: 'Error reading building IDs' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
  console.log(`Debug page available at http://localhost:${PORT}/debug`);
});