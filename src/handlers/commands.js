// Bot commands and handlers
function setupCommands(bot) {
    bot.start((ctx) => {
        const welcomeMessage = `
🧪 **Cannabis-Analyse-Bericht-Bot**

Sende mir einfach eine ZIP-Datei mit deinen Labordaten um loszulegen! 🧪📊
        `;
        
        ctx.replyWithMarkdown(welcomeMessage);
    });

    bot.help((ctx) => {
        const helpMessage = `
📋 **Cannabis-Analyse-Bericht-Bot**
        `;
        
        ctx.replyWithMarkdown(helpMessage);
    });

    // Handle other file types
    bot.on('photo', (ctx) => {
        ctx.reply('❌ Bitte sende eine ZIP-Datei mit CSV-Dateien, keine Bilder.');
    });

    bot.on('video', (ctx) => {
        ctx.reply('❌ Bitte sende eine ZIP-Datei mit CSV-Dateien, keine Videos.');
    });

    // Handle text messages
    bot.on('text', (ctx) => {
        ctx.reply('👋 Sende mir eine ZIP-Datei mit CSV-Dateien, und ich konvertiere sie zu ASCII-Tabellen!\n\nVerwende /help für weitere Informationen.');
    });
}

module.exports = {
    setupCommands
}; 