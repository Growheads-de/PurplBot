const { Markup } = require('telegraf');

// Helper function to convert CSV data to ASCII table with print buttons
function csvToAsciiTable(csvData, fileName, chatId, csvDataStore) {
    try {
        if (!csvData || csvData.length === 0) {
            return { message: `📄 *${fileName}*\n\nKeine Daten in dieser CSV-Datei gefunden.`, buttons: null };
        }
        
        const allHeaders = Object.keys(csvData[0]);
        if (allHeaders.length === 0) {
            return { message: `📄 *${fileName}*\n\nKeine gültigen Spalten in dieser CSV-Datei gefunden.`, buttons: null };
        }
        
        // Filter out ID and Application columns
        const headers = allHeaders.filter(header => {
            const lowerHeader = header.toLowerCase();
            return !lowerHeader.includes('id') && !lowerHeader.includes('applicat');
        });
        
        // Find Name column (case insensitive) for button identification
        const nameColumn = allHeaders.find(h => h.toLowerCase() === 'name') || allHeaders.find(h => h.toLowerCase().includes('name'));
        const idColumn = nameColumn || allHeaders.find(h => h.toLowerCase() === 'id') || allHeaders.find(h => h.toLowerCase().includes('id'));
        
        // Store CSV data for print buttons (use all headers for data access)
        const dataKey = `${chatId}_${Date.now()}`;
        csvDataStore.set(dataKey, { csvData, fileName, headers: allHeaders, idColumn, nameColumn });
        
        // Clean up old data (keep only last 10 entries per chat)
        const oldKeys = Array.from(csvDataStore.keys()).filter(k => k.startsWith(`${chatId}_`)).sort().slice(0, -10);
        oldKeys.forEach(key => csvDataStore.delete(key));
        
        // Limit rows to prevent message being too long
        const maxRows = 20; // Reduced for better mobile display
        const dataToShow = csvData.slice(0, maxRows);
        
        // Calculate column widths with special handling for Name and Timestamp
        const getColumnWidth = (header) => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('name')) {
                return 15; // Wider for name column
            } else if (lowerHeader.includes('timestamp') || lowerHeader.includes('time')) {
                return 20; // Much wider for timestamp column to show full date/time
            } else {
                return 8; // Standard width for other columns
            }
        };
        
        // Create simple table format that works well in Telegram
        let result = `📄 *${fileName.replace(/[*_`]/g, '')}*\n\n`;
        
        // Create header row with variable column widths
        const headerRow = headers.map(h => {
            const width = getColumnWidth(h);
            return h.substring(0, width).padEnd(width);
        }).join('│');
        const separator = headers.map(h => '─'.repeat(getColumnWidth(h))).join('┼');
        
        result += '```\n';
        result += headerRow + '\n';
        result += separator + '\n';
        
        // Add data rows with variable column widths
        dataToShow.forEach(row => {
            const rowData = headers.map(header => {
                const width = getColumnWidth(header);
                const value = row[header] || '';
                const cleanValue = value.toString().replace(/[`*_~\n\r]/g, ' ').trim();
                return cleanValue.length > width ? 
                    cleanValue.substring(0, width - 3) + '...' : 
                    cleanValue.padEnd(width);
            });
            result += rowData.join('│') + '\n';
        });
        
        result += '```';
        
        // Add summary info
        result += `\n\n📊 *Zusammenfassung:*`;
        result += `\n• Zeilen: ${dataToShow.length}${csvData.length > maxRows ? ` von ${csvData.length}` : ''}`;
        result += `\n• Spalten: ${headers.length}`;
        
        if (csvData.length > maxRows) {
            result += `\n\n⚠️ _Erste ${maxRows} Zeilen für mobile Lesbarkeit angezeigt_`;
        }
        
        // Create print buttons if Name or ID column exists
        let buttons = null;
        if (idColumn) {
            const buttonRows = [];
            const rowsPerButton = Math.ceil(dataToShow.length / 10); // Max 10 buttons per message
            
            for (let i = 0; i < dataToShow.length; i += rowsPerButton) {
                const rowGroup = dataToShow.slice(i, i + rowsPerButton);
                const buttonRow = rowGroup.map(row => {
                    const displayValue = row[idColumn];
                    if (displayValue) {
                        const buttonText = displayValue.length > 12 ? displayValue.substring(0, 12) + '...' : displayValue;
                        return Markup.button.callback(`📋 Bericht ${buttonText}`, `get_report_${dataKey}_${csvData.indexOf(row)}`);
                    }
                }).filter(Boolean);
                
                if (buttonRow.length > 0) {
                    buttonRows.push(buttonRow);
                }
            }
            
            if (buttonRows.length > 0) {
                buttons = Markup.inlineKeyboard(buttonRows);
                result += `\n\n📋 _Klicke einen Button für einen Bericht zu ${nameColumn ? 'Name' : 'ID'}_`;
            }
        }
        
        return { message: result, buttons };
        
    } catch (error) {
        console.error('Error creating ASCII table:', error);
        return { message: `📄 *${fileName}*\n\nFehler beim Verarbeiten der CSV-Datei: ${error.message}`, buttons: null };
    }
}

// Helper function to send long messages with proper splitting
async function sendLongMessage(ctx, message, buttons = null) {
    const maxLength = 4000; // Leave some buffer for Telegram's 4096 limit
    
    if (message.length <= maxLength) {
        try {
            // Use simple markdown parsing
            if (buttons) {
                await ctx.replyWithMarkdown(message, buttons);
            } else {
                await ctx.replyWithMarkdown(message);
            }
        } catch (error) {
            console.warn('Markdown parsing failed, sending as plain text:', error.message);
            // Convert markdown to plain text if parsing fails
            const plainText = message
                .replace(/\*([^*]+)\*/g, '$1')     // *italic* -> italic
                .replace(/_([^_]+)_/g, '$1')      // _italic_ -> italic  
                .replace(/`([^`]+)`/g, '$1')      // `code` -> code
                .replace(/📄 \*([^*]+)\*/g, '📄 $1'); // File name
            
            if (buttons) {
                await ctx.reply(plainText, buttons);
            } else {
                await ctx.reply(plainText);
            }
        }
        return;
    }
    
    // For long messages, split at logical points (buttons only on last part)
    const parts = [];
    let currentPart = '';
    const lines = message.split('\n');
    
    for (const line of lines) {
        if (currentPart.length + line.length + 1 > maxLength) {
            if (currentPart.trim()) {
                parts.push(currentPart.trim());
            }
            currentPart = line;
        } else {
            currentPart += (currentPart ? '\n' : '') + line;
        }
    }
    
    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }
    
    // Send all parts
    for (let i = 0; i < parts.length; i++) {
        const isLastPart = i === parts.length - 1;
        const partButtons = isLastPart ? buttons : null;
        
        try {
            if (partButtons) {
                await ctx.replyWithMarkdown(parts[i], partButtons);
            } else {
                await ctx.replyWithMarkdown(parts[i]);
            }
        } catch (error) {
            // Convert to plain text if markdown fails
            const plainText = parts[i]
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/_([^_]+)_/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/📄 \*([^*]+)\*/g, '📄 $1');
            
            if (partButtons) {
                await ctx.reply(plainText, partButtons);
            } else {
                await ctx.reply(plainText);
            }
        }
        
        if (i < parts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

module.exports = {
    csvToAsciiTable,
    sendLongMessage
}; 