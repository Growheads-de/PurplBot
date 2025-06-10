const { Markup } = require('telegraf');
const { downloadFile, processZipFile, cleanupFile } = require('../utils/fileHandler');
const { csvToAsciiTable, sendLongMessage } = require('../utils/tableFormatter');
const { renderReportBuffer, printReport } = require('../services/reportGenerator');
const { checkAuthorization } = require('../config/auth');

function setupDocumentHandlers(bot, csvDataStore, tempDir) {
    // Handle document uploads
    bot.on('document', async (ctx) => {
        const document = ctx.message.document;
        
        // Check if it's a ZIP file
        if (!document.mime_type || !document.mime_type.includes('zip')) {
            return ctx.reply('❌ Bitte sende eine ZIP-Datei mit CSV-Dateien.');
        }
        
        // Check file size (Telegram limit is 20MB for bots)
        if (document.file_size > 20 * 1024 * 1024) {
            return ctx.reply('❌ Datei zu groß. Bitte sende Dateien kleiner als 20MB.');
        }
        
        const statusMessage = await ctx.reply('⏳ Verarbeite deine ZIP-Datei...');
        
        let zipPath;
        try {
            // Download the file
            zipPath = await downloadFile(bot, document.file_id, tempDir);
            
            // Process the ZIP file
            const csvFiles = await processZipFile(zipPath);
            
            if (csvFiles.length === 0) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    statusMessage.message_id,
                    null,
                    '❌ Keine CSV-Dateien im ZIP-Archiv gefunden.'
                );
                return;
            }
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `✅ ${csvFiles.length} CSV-Datei(en) gefunden. Konvertiere zu Tabellen...`
            );
            
            // Convert each CSV to ASCII table and send
            for (const csvFile of csvFiles) {
                const tableResult = csvToAsciiTable(csvFile.data, csvFile.fileName, ctx.chat.id, csvDataStore);
                
                // Send message with proper error handling and buttons
                await sendLongMessage(ctx, tableResult.message, tableResult.buttons);
            }
            
            // Delete the status message
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);
            
        } catch (error) {
            console.error('Error processing file:', error);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `❌ Fehler beim Verarbeiten der Datei: ${error.message}`
            );
        } finally {
            // Clean up temporary file
            if (zipPath) {
                cleanupFile(zipPath);
            }
        }
    });

    // Handle get report button callbacks
    bot.action(/^get_report_(.+)_(\d+)$/, async (ctx) => {
        try {
            const [, dataKey, rowIndex] = ctx.match;
            const storedData = csvDataStore.get(dataKey);
            
            if (!storedData) {
                await ctx.answerCbQuery('❌ Daten nicht mehr verfügbar. Bitte lade die Datei erneut hoch.');
                return;
            }
            
            const { originalCsvData, fileName, headers, idColumn, nameColumn } = storedData;
            const row = originalCsvData[parseInt(rowIndex)];
            
            if (!row) {
                await ctx.answerCbQuery('❌ Zeile nicht gefunden.');
                return;
            }
            
            // Answer the callback query immediately
            await ctx.answerCbQuery('📋 Generiere Bericht...');
            
            // Extract data for report generation - prioritize Name over ID
            const sampleName = row[idColumn] || 'Unbekannt';
            
            // Try to find timestamp column
            const timestampColumns = ['timestamp', 'date', 'time', 'datetime', 'created_at'];
            const timestampColumn = headers.find(h => 
                timestampColumns.some(tc => h.toLowerCase().includes(tc))
            );
            const timestamp = timestampColumn ? row[timestampColumn] : new Date().toISOString();
            
            // Try to find THC column
            const thcColumns = ['thc', 'thc_content', 'thc%', 'thc_percent'];
            const thcColumn = headers.find(h => 
                thcColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const thcValue = thcColumn ? parseFloat(row[thcColumn]) || 0 : 0;
            
            // Try to find CBD column
            const cbdColumns = ['cbd', 'cbd_content', 'cbd%', 'cbd_percent'];
            const cbdColumn = headers.find(h => 
                cbdColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const cbdValue = cbdColumn ? parseFloat(row[cbdColumn]) || 0 : 0;
            
            // Try to find moisture column
            const moistureColumns = ['moisture', 'humidity', 'water', 'feuchtigkeit'];
            const moistureColumn = headers.find(h => 
                moistureColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const moistureValue = moistureColumn ? parseFloat(row[moistureColumn]) || 0 : 0;
            
            // Try to find water activity column
            const waterActivityColumns = ['water_activity', 'aw', 'water_ac', 'wasseraktivitaet'];
            const waterActivityColumn = headers.find(h => 
                waterActivityColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const waterActivityValue = waterActivityColumn ? parseFloat(row[waterActivityColumn]) || 0 : 0;
            
            // Generate the report
            const reportBuffer = await renderReportBuffer(
                sampleName,
                timestamp,
                thcValue,
                cbdValue,
                moistureValue,
                waterActivityValue
            );
            
            // Send the report as a photo with print button
            const printButton = Markup.inlineKeyboard([
                Markup.button.callback('🖨️ Drucken', `print_${dataKey}_${rowIndex}`)
            ]);
            
            await ctx.replyWithPhoto(
                { source: reportBuffer },
                { 
                    caption: `📋 Analysebericht für ${nameColumn ? 'Name' : 'ID'}: ${sampleName}\n\nGeneriert aus: ${fileName}`,
                    parse_mode: 'Markdown',
                    ...printButton
                }
            );
            
        } catch (error) {
            console.error('Error generating report:', error);
            await ctx.answerCbQuery('❌ Fehler beim Generieren des Berichts. Bitte versuche es erneut.');
        }
    });

    // Handle thermal print button callbacks
    bot.action(/^print_(.+)_(\d+)$/, async (ctx) => {
        // Check authorization for print functionality
        try {
            await checkAuthorization(ctx, () => {});
        } catch (authError) {
            await ctx.answerCbQuery('❌ Du bist nicht berechtigt, die Druckfunktion zu verwenden.');
            return;
        }

        try {
            const [, dataKey, rowIndex] = ctx.match;
            const storedData = csvDataStore.get(dataKey);
            
            if (!storedData) {
                await ctx.answerCbQuery('❌ Daten nicht mehr verfügbar. Bitte lade die Datei erneut hoch.');
                return;
            }
            
            const { originalCsvData, fileName, headers, idColumn, nameColumn } = storedData;
            const row = originalCsvData[parseInt(rowIndex)];
            
            if (!row) {
                await ctx.answerCbQuery('❌ Zeile nicht gefunden.');
                return;
            }
            
            // Answer the callback query immediately
            await ctx.answerCbQuery('🖨️ Sende an Drucker...');
            
            // Extract data for report generation
            const sampleName = row[idColumn] || 'Unbekannt';
            
            // Try to find timestamp column
            const timestampColumns = ['timestamp', 'date', 'time', 'datetime', 'created_at'];
            const timestampColumn = headers.find(h => 
                timestampColumns.some(tc => h.toLowerCase().includes(tc))
            );
            const timestamp = timestampColumn ? row[timestampColumn] : new Date().toISOString();
            
            // Try to find THC column
            const thcColumns = ['thc', 'thc_content', 'thc%', 'thc_percent'];
            const thcColumn = headers.find(h => 
                thcColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const thcValue = thcColumn ? parseFloat(row[thcColumn]) || 0 : 0;
            
            // Try to find CBD column
            const cbdColumns = ['cbd', 'cbd_content', 'cbd%', 'cbd_percent'];
            const cbdColumn = headers.find(h => 
                cbdColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const cbdValue = cbdColumn ? parseFloat(row[cbdColumn]) || 0 : 0;
            
            // Try to find moisture column
            const moistureColumns = ['moisture', 'humidity', 'water', 'feuchtigkeit'];
            const moistureColumn = headers.find(h => 
                moistureColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const moistureValue = moistureColumn ? parseFloat(row[moistureColumn]) || 0 : 0;
            
            // Try to find water activity column
            const waterActivityColumns = ['water_activity', 'aw', 'water_ac', 'wasseraktivitaet'];
            const waterActivityColumn = headers.find(h => 
                waterActivityColumns.some(tc => h.toLowerCase().includes(tc.toLowerCase()))
            );
            const waterActivityValue = waterActivityColumn ? parseFloat(row[waterActivityColumn]) || 0 : 0;
            
            // Generate the report PNG
            const png = await renderReportBuffer(
                sampleName,
                timestamp,
                thcValue,
                cbdValue,
                moistureValue,
                waterActivityValue
            );
            
            // Print to thermal printer
            try {
                await printReport(png, sampleName);
                await ctx.reply(`✅ Bericht erfolgreich gedruckt für ${nameColumn ? 'Name' : 'ID'}: ${sampleName}`);
            } catch (printerError) {
                console.error("Print error:", printerError);
                await ctx.reply(`❌ ${printerError.message}`);
            }
            
        } catch (error) {
            console.error('Error printing report:', error);
            await ctx.reply('❌ Fehler beim Drucken des Berichts. Bitte versuche es erneut.');
        }
    });
}

module.exports = {
    setupDocumentHandlers
}; 