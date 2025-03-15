const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});


client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to authenticate.');
});


client.on('authenticated', () => {
    console.log('Client is authenticated!');
});


client.on('ready', () => {
    console.log('Client is ready!');
});


async function sendPoll(chatId, messageBody) {
    const parts = messageBody.split("|").map(p => p.trim()); 

    if (parts.length < 3) { 
        await client.sendMessage(chatId, " Incorrect format! Use:\n`!poll Question? | Option1 | Option2 | Option3`");
        return;
    }

    const pollName = parts[0].replace("!poll", "").trim(); 
    const pollOptions = parts.slice(1);

    try {
        const poll = new Poll(pollName, pollOptions, { allowMultipleAnswers: false });
        await client.sendMessage(chatId, poll);
        console.log("Poll sent successfully!");
    } catch (error) {
        console.error("Error sending poll:", error);
    }
}


async function tagAll(chat) {
    let text = ' @all:\n';
    let mentions = chat.participants.map(p => p.id._serialized);

    for (let participant of chat.participants) {
        text += `@${participant.id.user} `;
    }

    await chat.sendMessage(text, { mentions });
}


client.on('message', async (msg) => {
    console.log('MESSAGE RECEIVED:', msg.body);

    try {
        const chat = await msg.getChat();
        const isGroupChat = chat.isGroup;

        if (msg.body.toLowerCase() === "hello") {
            msg.reply("Hello! How can I assist you?");
            return;
        }

        if (msg.body.toLowerCase() === "@all" && isGroupChat) {
            await tagAll(chat);
            return;
        }

        if (msg.body.toLowerCase().startsWith("!poll")) {
            await sendPoll(msg.from, msg.body);
            return;
        }
    } catch (error) {
        console.error("Error handling message:", error);
    }
});


client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});


client.initialize();
