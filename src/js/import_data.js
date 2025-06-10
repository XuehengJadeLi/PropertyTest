const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');
const readline = require('readline');

// Database connection configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rotterdam_property_data',
  password: '123456',
  port: 5432,
});

// Function to import data
async function importData(filePath) {
  try {
    console.log(`Importing data from ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File ${filePath} does not exist`);
      return;
    }
    
    // Create a readable stream for the file
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isFirstLine = true;
    let lineCount = 0;
    let importCount = 0;
    const client = await pool.connect();

    try {
      for await (const line of rl) {
        // Skip header line
        if (isFirstLine) {
          isFirstLine = false;
          continue;
        }

        lineCount++;
        if (lineCount % 1000 === 0) {
          console.log(`Processed ${lineCount} lines...`);
        }

        // Parse the CSV line
        const values = line.split(';');
        if (values.length < 16) {
          console.warn(`Skipping line ${lineCount}: insufficient columns`);
          continue;
        }
        
        const [
          wozobjectnr, straat, hnr, hltr, pstc, pandid, 
          vboid, numid, bwjr, bag_gebruiksdoel, 
          woz_gebruikscode, woz_gebruikscode_oms, 
          bwlg_vb0, laagste_bwlg_pnd, hoogste_bwlg_pnd, aant_bwlg_pnd
        ] = values;

        // Insert data into PostgreSQL
        await client.query(
          `INSERT INTO woz_objects (
            wozobjectnr, straat, hnr, hltr, pstc, pandid, vboid, numid, 
            bwjr, bag_gebruiksdoel, woz_gebruikscode, woz_gebruikscode_oms, 
            bwlg_vb0, laagste_bwlg_pnd, hoogste_bwlg_pnd, aant_bwlg_pnd
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            wozobjectnr, straat, hnr, hltr, pstc, pandid, vboid, numid, 
            parseInt(bwjr) || null, bag_gebruiksdoel, woz_gebruikscode, woz_gebruikscode_oms, 
            parseInt(bwlg_vb0) || null, parseInt(laagste_bwlg_pnd) || null, 
            parseInt(hoogste_bwlg_pnd) || null, parseInt(aant_bwlg_pnd) || null
          ]
        );
        importCount++;
      }
      console.log(`Data import completed successfully. Imported ${importCount} records from ${lineCount} lines.`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await pool.end();
  }
}

// Use the existing file in the root directory
const filePath = path.resolve(__dirname, '../../BAGWOZ_DATASET.txt');
importData(filePath); 