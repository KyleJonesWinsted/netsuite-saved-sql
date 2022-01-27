#!/usr/bin/env node

const exec = require('child_process').exec;
const fs = require('fs/promises');
const path = require('path');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  let exitCode = 0;
  try {
    const folderId = await getSqlFolderId();
    await cloneRepo('https://github.com/KyleJonesWinsted/netsuite-saved-sql');
    await buildRepo();
    await installFiles();
    await modifyScriptObject(folderId);
    await createDeployXml();
    console.log(deploymentInstructions);
  } catch (err) {
    console.error(err);
    exitCode = 1;
  }
  await cleanup();
  process.exit(exitCode);
}

async function getSqlFolderId() {
  console.log('Getting SQL file folder ID...');
  return new Promise((resolve) => {
    readline.question('\nEnter the internal ID of a folder to save SQL queries to: ', (answer) => {
      resolve(answer.trim());
    });
  })
}

async function modifyScriptObject(folderId) {
  console.log('Modifying script object...');
  const filePath = path.join('Objects', 'Scripts', 'Suitelet', 'customscript_saved_sql_sl.xml');
  const fileBuffer = await fs.readFile(filePath);
  const fileContent = fileBuffer.toString().replace(
      /<custscript_sql_file_folder>.*<\/custscript_sql_file_folder>/, 
      `<custscript_sql_file_folder>${folderId}</custscript_sql_file_folder>`
  );
  await fs.writeFile(filePath, fileContent);
}

async function createDeployXml() {
  console.log('Creating deploy.xml...');
  const deployContent = `\
<deploy>
  <files>
    <path>~/FileCabinet/SuiteScripts/BerganKDV/Client/saved_sql_cl.js</path>
    <path>~/FileCabinet/SuiteScripts/BerganKDV/Suitelet/saved_sql_sl.js</path>
  </files>
  <objects>
    <path>~/Objects/Scripts/Suitelet/customscript_saved_sql_sl.xml</path>
  </objects>
</deploy>
    `;
  fs.writeFile('deploy.xml', deployContent);
}

async function installFiles() {
  console.log('Installing module files...');
  const fileCabinetPath = 'FileCabinet/SuiteScripts/BerganKDV';
  const suitelet = moveFile(`${fileCabinetPath}/Suitelet/saved_sql_sl.js`);
  const client = moveFile(`${fileCabinetPath}/Client/saved_sql_cl.js`);
  const scriptObj = moveFile('Objects/Scripts/Suitelet/customscript_saved_sql_sl.xml');
  await Promise.all([suitelet, client, scriptObj]);
}

async function moveFile(outputPath) {
  const outputPathComponents = outputPath.split('/');
  const outputFolder = path.join(...outputPathComponents.slice(0, -1));
  const outputFileName = outputPathComponents.at(-1);
  await fs.mkdir(outputFolder, { recursive: true });
  await fs.copyFile(
    path.join('netsuite-saved-sql', outputFolder, outputFileName),
    path.join(outputFolder, outputFileName)
  );
}

async function cloneRepo(url) {
  console.log(`Cloning ${url}...`);
  await runCommand(`git clone ${url}`);
}

async function buildRepo() {
  console.log(`Building scripts...`);
  const folderPath = 'netsuite-saved-sql';
  await runCommandAtPath('npm install', folderPath);
  await runCommandAtPath('npm run build', folderPath);
}

async function runCommandAtPath(command, path) {
  const startingDir = process.cwd();
  process.chdir(path);
  const cmd = runCommand(command);
  process.chdir(startingDir);
  await cmd;
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function cleanup() {
  console.log('Cleaning up...');
  await fs.rm('netsuite-saved-sql', {
    recursive: true,
    force: true,
  });
}

const deploymentInstructions = `
    deploy.xml has been updated
    Run project deployment to finish installation
`;

main();