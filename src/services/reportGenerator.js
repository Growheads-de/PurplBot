const { createCanvas } = require('canvas');
const sharp = require('sharp');
const fs = require('fs');
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');

// Rendering functions for creating PNG reports
const offset = 21;

function drawLine(item, line, context, opts) {
    if (opts?.double || item.startsWith('<:D:>') || item.startsWith('<:E:>')) {
        context.scale(1, 2);
    }

    if (item.startsWith('<:C:>')) {
        context.font = "bold 22px Roboto Mono";
    } else if (item.startsWith('<:E:>')) {
        context.font = "bold 22px Roboto Mono";
    } else if (item.startsWith('<:B:>')) {
        context.font = "21px Roboto Mono";
    } else {
        context.font = "22px Roboto Mono";
    }
    context.fillStyle = "black";
    context.strokeStyle = 'rgb(0,0,0)';

    if (item.startsWith('<:A:>')) {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i + 5, i + 6), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 0), (line * (opts?.double ? 12 : 24)) + offset);
        }
    }
    else if (item.startsWith('<:B:>')) {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i + 5, i + 6), i * 10 + (opts?.center ? (Math.round((48 - item.length) * 5)) : 0), (line * (opts?.double ? 12 : 24)) + offset);
        }
    }
    else if (item.startsWith('<:C:>')) {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i + 5, i + 6), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 0), (line * (opts?.double ? 12 : 24)) + offset);
        }
    }
    else if (item.startsWith('<:D:>')) {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i + 5, i + 6), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 0), (line * (12)) + offset);
        }
    }
    else if (item.startsWith('<:E:>')) {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i + 5, i + 6), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 0), (line * (12)) + offset);
        }
    }
    else {
        for (let i = 0; i < item.length; i++) {
            context.fillText(item.substring(i, i + 1), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 0), (line * (opts?.double ? 12 : 24)) + offset);
        }
    }

    if (opts?.double || item.startsWith('<:D:>') || item.startsWith('<:E:>')) {
        context.scale(1, 0.5);
    }
}

function drawLineO(item, line, context, opts) {
    if (opts?.double) {
        context.scale(1, 2);
    }
    context.font = "22px Roboto Mono";
    context.fillStyle = "black";
    context.strokeStyle = 'rgb(0,0,0)';

    for (let i = 0; i < item.length; i++) {
        context.fillText(item.substring(i, i + 1), i * 12 + (opts?.center ? (Math.round((48 - item.length) * 6)) : 6), (line * (opts?.double ? 12 : 24)) + offset);
    }

    if (opts?.double) {
        context.scale(1, 0.5);
    }
}

async function renderReport(sampleName, timestamp, THC_content, CBD_content, moisture, waterActivity) {
    // Calculate canvas height based on content
    const baseHeight = 600; // Base height for the report
    const canvas = createCanvas(576, baseHeight);
    const context = canvas.getContext("2d", {});

    // Set background
    context.fillStyle = "#e0e0e0";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textRendering = "geometricPrecision";

    let line = 0;

    // Header
    drawLine('ANALYSE BERICHT', line++, context, { double: true, center: true });
    line++;
    drawLine('================================================', line, context);
    drawLineO('===============================================', line++, context);
    line++;

    // Sample Information
    drawLine('<:C:>PROBENINFORMATIONEN', line++, context);
    line++;
    drawLine('Probenname: ' + sampleName, line++, context);

    // Format timestamp
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    drawLine('Datum/Zeit: ' + formattedDate, line++, context);
    line++;

    // Analysis Results Header
    drawLine('------------------------------------------------', line, context);
    drawLineO('-----------------------------------------------', line++, context);
    drawLine('<:C:>ANALYSEERGEBNISSE', line++, context);
    drawLine('------------------------------------------------', line, context);
    drawLineO('-----------------------------------------------', line++, context);
    line++;

    // THC Content
    drawLine('THC-Gehalt:', line++, context);
    drawLine('  ' + THC_content.toFixed(2) + ' %', line++, context);
    line++;

    // CBD Content
    drawLine('CBD-Gehalt:', line++, context);
    drawLine('  ' + CBD_content.toFixed(2) + ' %', line++, context);
    line++;

    // Moisture
    drawLine('Feuchtigkeit:', line++, context);
    drawLine('  ' + moisture.toFixed(2) + ' %', line++, context);
    line++;

    // Water Activity
    drawLine('Wasseraktivitaet (aw):', line++, context);
    drawLine('  ' + waterActivity.toFixed(3), line++, context);
    line++;

    return canvas;
}

async function renderReportBuffer(sampleName, timestamp, THC_content, CBD_content, moisture, waterActivity) {
    const canvas = await renderReport(sampleName, timestamp, THC_content, CBD_content, moisture, waterActivity);
    const buf = canvas.toBuffer();
    const pic = sharp(buf);
    const png = await pic.toBuffer();
    return png;
}

// Thermal printer functions
async function printReport(reportBuffer, sampleName) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${process.env.THERMAL_PRINTER_IP || '192.168.1.100'}:${process.env.THERMAL_PRINTER_PORT || '9100'}`,
        replaceSpecialCharacters: true,
        characterSet: CharacterSet.ISO8859_15_LATIN9,
        breakLine: BreakLine.WORD,
        extraSpecialCharacters: {'€': 164}
    });

    const isConnected = await printer.isPrinterConnected();
    console.log("Printer connected:", isConnected);
    
    if (!isConnected) {
        throw new Error(`Drucker bei tcp://${process.env.THERMAL_PRINTER_IP || '192.168.1.100'}:${process.env.THERMAL_PRINTER_PORT || '9100'} nicht verbunden. Bitte prüfe die Druckerverbindung.`);
    }
    
    printer.add(Buffer.from([0x1B, 0x74, 40]));
    printer.add(Buffer.from([0x1D, 0x28, 0x4B, 0x02, 0x00, 0x32, 0x06]));
    printer.alignCenter();
    
    // Print logo if it exists
    if (fs.existsSync("./bonlogo.png")) {
        await printer.printImage("./bonlogo.png");
        printer.newLine();
    }
    
    // Save and print the report
    fs.writeFileSync('./bontmp.png', reportBuffer);
    await printer.printImage("./bontmp.png");
    printer.newLine();
    printer.cut();

    await printer.execute();
    console.log("Print success.");
    
    // Clean up temporary file
    if (fs.existsSync('./bontmp.png')) {
        fs.unlinkSync('./bontmp.png');
    }
    
    return true;
}

module.exports = {
    renderReport,
    renderReportBuffer,
    printReport
}; 