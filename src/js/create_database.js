const { Pool } = require('pg');

// PostgreSQL connection for initial connection (without specific database)
const initialPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres', // Connect to default database first
  password: '123456',
  port: 5432,
});

// Connection details for the new database
const dbName = 'rotterdam_property_data';

async function createDatabase() {
  let initialClient;

  try {
    console.log('Connecting to PostgreSQL...');
    initialClient = await initialPool.connect();

    // Check if database already exists
    const checkResult = await initialClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (checkResult.rowCount === 0) {
      // Create the database if it doesn't exist
      console.log(`Creating database "${dbName}"...`);
      await initialClient.query(`CREATE DATABASE ${dbName}`);
      console.log('Database created successfully');
    } else {
      console.log(`Database "${dbName}" already exists`);
    }

    // Close initial connection
    await initialClient.release();
    await initialPool.end();

    // Connect to the new database to create tables
    const dbPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: dbName,
      password: '123456',
      port: 5432,
    });

    const dbClient = await dbPool.connect();

    // Check if table already exists
    const tableCheck = await dbClient.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'woz_objects'"
    );

    if (tableCheck.rowCount === 0) {
      console.log('Creating woz_objects table...');
      // Create table if it doesn't exist
      await dbClient.query(`
        CREATE TABLE woz_objects (
          id SERIAL PRIMARY KEY,
          wozobjectnr VARCHAR(20) NOT NULL,
          straat VARCHAR(100),
          hnr VARCHAR(20),
          hltr VARCHAR(10),
          pstc VARCHAR(10),
          pandid VARCHAR(20) NOT NULL,
          vboid VARCHAR(20),
          numid VARCHAR(20),
          bwjr INTEGER,
          bag_gebruiksdoel VARCHAR(50),
          woz_gebruikscode VARCHAR(10),
          woz_gebruikscode_oms VARCHAR(100),
          bwlg_vb0 INTEGER,
          laagste_bwlg_pnd INTEGER,
          hoogste_bwlg_pnd INTEGER,
          aant_bwlg_pnd INTEGER
        )
      `);

      console.log('Creating index on pandid...');
      await dbClient.query('CREATE INDEX idx_pandid ON woz_objects(pandid)');
      console.log('Table and index created successfully');
    } else {
      console.log('Table woz_objects already exists');
    }

    await dbClient.release();
    await dbPool.end();

    console.log('Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Import WOZ data:     npm run import');
    console.log('2. Start the application: npm start');

  } catch (error) {
    console.error('Error setting up database:', error);
    if (initialClient) initialClient.release();
    await initialPool.end();
    process.exit(1);
  }
}

createDatabase(); 