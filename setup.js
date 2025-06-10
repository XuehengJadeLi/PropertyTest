const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to update database credentials
function updateCredentials(pgUser, pgPassword) {
  const filesToUpdate = [
    path.join(__dirname, 'src/js/import_data.js'),
    path.join(__dirname, 'src/server.js')
  ];

  filesToUpdate.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/user: ['"]postgres['"]/, `user: '${pgUser}'`);
    content = content.replace(/password: ['"]your_password['"]/, `password: '${pgPassword}'`);
    fs.writeFileSync(filePath, content);
  });
}

// Main setup function
async function setup() {
  console.log('Rotterdam Property Valuation Viewer Setup');
  console.log('========================================\n');

  // Prompt for PostgreSQL credentials
  rl.question('PostgreSQL username (default: postgres): ', (pgUser) => {
    pgUser = pgUser || 'postgres';

    rl.question('PostgreSQL password: ', (pgPassword) => {
      if (!pgPassword) {
        console.error('Password is required');
        rl.close();
        return;
      }

      console.log('\nUpdating database configuration...');
      updateCredentials(pgUser, pgPassword);
      
      console.log('\nSetup complete!');
      console.log('\nNext steps:');
      console.log('1. Install dependencies:    npm install');
      console.log('2. Create database:         psql -U ' + pgUser + ' -f src/js/database.sql');
      console.log('3. Import WOZ data:         npm run import');
      console.log('4. Start the application:   npm start');

      rl.close();
    });
  });
}

// Run setup
setup(); 