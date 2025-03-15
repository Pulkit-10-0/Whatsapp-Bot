const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code');
});


client.on('authenticated', () => {
    console.log('Client is authenticated!');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

async function isAdmin(chat, senderId) {
    const participant = chat.participants.find(p => p.id._serialized === senderId);
    return participant ? participant.isAdmin || participant.isSuperAdmin : false;
}


async function setAdminsOnly(chat, enable) {
    try {
        console.log(`Attempting to set admins-only to: ${enable} in group: ${chat.name}`);

        const success = await chat.setMessagesAdminsOnly(enable);

        if (success) {
            await chat.sendMessage(enable ? "Dictatorship Mode Enabled!* Only admins can send messages." : "Democracy Restored!* Everyone can send messages.");
            console.log("Group setting changed successfully.");
        } else {
            console.log("Failed to change group settings.");
            await chat.sendMessage("Failed to update settings.");
        }
    } catch (error) {
        console.error("⚠️ Error updating group settings:", error);
        await chat.sendMessage("Error updating settings. Please try again.");
    }
}

async function sendPoll(chatId, messageBody) {
    const parts = messageBody.split("|").map(p => p.trim());

    if (parts.length < 3) {
        await client.sendMessage(chatId, "Incorrect format! Use:\n`!poll Question? | Option1 | Option2 | Option3`");
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

// Function to reply with @all 
async function tagAll(msg, chat) {
    let text = "\n";
    let mentions = [];

    for (let participant of chat.participants) {
        let contact = await client.getContactById(participant.id._serialized);
        mentions.push(contact);
        text += `@${contact.id.user} `;
    }

    await msg.reply(text, undefined, { mentions });
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

        if (isGroupChat) {
            const senderId = msg.author || msg.from;
            const adminStatus = await isAdmin(chat, senderId);

            if (msg.body.toLowerCase() === "@all") {
                if (!adminStatus) {
                    await msg.reply("Only *group admins* can use @all.");
                    return;
                }
                await tagAll(msg, chat);
                return;
            }

            if (msg.body.toLowerCase().startsWith("!poll")) {
                if (!adminStatus) {
                    await msg.reply("Only *group admins* can create polls.");
                    return;
                }
                await sendPoll(msg.from, msg.body);
                return;
            }

            if (msg.body.toLowerCase() === "!dictatorship") {
                if (!adminStatus) {
                    await msg.reply("Only *group admins* can enable Dictatorship Mode.");
                    return;
                }
                await setAdminsOnly(chat, true);
                return;
            }

            if (msg.body.toLowerCase() === "!democracy") {
                if (!adminStatus) {
                    await msg.reply("Only *group admins* can restore Democracy Mode.");
                    return;
                }
                await setAdminsOnly(chat, false);
                return;
            }
        }

    } catch (error) {
        console.error("Error handling message:", error);
    }
});


client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});

client.initialize();
