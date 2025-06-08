const yauzl = require('yauzl');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper function to download file from Telegram
async function downloadFile(bot, fileId, tempDir) {
    try {
        const file = await bot.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        const tempPath = path.join(tempDir, `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.zip`);
        
        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(tempPath);
            https.get(fileUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(tempPath);
                });
            }).on('error', reject);
        });
    } catch (error) {
        throw new Error(`Failed to download file: ${error.message}`);
    }
}

// Helper function to extract and process CSV from zip
async function processZipFile(zipPath) {
    return new Promise((resolve, reject) => {
        const results = [];
        
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                return reject(err);
            }
            
            zipfile.readEntry();
            
            zipfile.on('entry', (entry) => {
                // Check if it's a CSV file
                if (entry.fileName.toLowerCase().endsWith('.csv') && !entry.fileName.includes('__MACOSX')) {
                    zipfile.openReadStream(entry, (err, readStream) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        const csvData = [];
                        readStream
                            .pipe(csv())
                            .on('data', (data) => csvData.push(data))
                            .on('end', () => {
                                results.push({
                                    fileName: entry.fileName,
                                    data: csvData
                                });
                                zipfile.readEntry();
                            })
                            .on('error', reject);
                    });
                } else {
                    zipfile.readEntry();
                }
            });
            
            zipfile.on('end', () => {
                resolve(results);
            });
            
            zipfile.on('error', reject);
        });
    });
}

// Helper function to clean up temp files
function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Error cleaning up file:', error);
    }
}

module.exports = {
    downloadFile,
    processZipFile,
    cleanupFile
}; 