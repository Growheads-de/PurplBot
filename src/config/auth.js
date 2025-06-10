require('dotenv').config();

// Load authorized users from environment
const authorizedUsers = process.env.AUTHORIZED_USERS 
    ? process.env.AUTHORIZED_USERS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : [];

// Authorization middleware
const checkAuthorization = (ctx, next) => {
    const userId = ctx.from?.id;
    
    if (!userId) {
        return ctx.reply('❌ Benutzer kann nicht identifiziert werden.');
    }
    
    if (authorizedUsers.length === 0 || authorizedUsers.includes(userId)) {
        return next();
    }
    
    // User not authorized - show their ID for whitelisting
    const message = `🚫 **Zugang verweigert**

Deine Telegram ID: \`${userId}\`

PurplBot ist nur für autorisierte Benutzer verfügbar. Bitte kontaktiere den Administrator um Zugang mit der obigen ID zu beantragen.

_Hinweis: Du kannst deine ID kopieren, indem du darauf tippst._`;
    
    return ctx.replyWithMarkdown(message);
};

module.exports = {
    checkAuthorization,
    authorizedUsers
}; 