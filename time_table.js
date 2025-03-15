const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ],
    },
});

const timetable = JSON.parse(fs.readFileSync('timetable.json', 'utf-8'));

const GROUP_ID = 'xxxxxxxxxxx@g.us';


function getCronDay(day) {
    const days = { 
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
        'Thursday': 4, 'Friday': 5, 'Saturday': 6, 
        'Sunday': 7
    };
    return days[day];
}


async function sendMessageWithRetry(message, attempt = 1) {
    try {
        await client.sendMessage(GROUP_ID, message);
        console.log(`📩 Sent: ${message}`);
    } catch (error) {
        console.error(`Error sending message (Attempt ${attempt}):`, error);
        if (attempt < 3) {
            console.log("Retrying in 5 seconds...");
            await new Promise(res => setTimeout(res, 5000));
            await sendMessageWithRetry(message, attempt + 1);
        } else {
            console.log("Failed to send message after 3 attempts.");
        }
    }
}


function scheduleClassReminders() {
    Object.keys(timetable).forEach(day => {
        timetable[day].forEach(entry => {
            const [hour, minute] = entry.time.split(":");
            const cronTime = `${minute} ${hour} * * ${getCronDay(day)}`;

         
            const reminderMinute = Math.max(0, parseInt(minute) - 5);
            const reminderCronTime = `${reminderMinute} ${hour} * * ${getCronDay(day)}`;

        
            cron.schedule(reminderCronTime, () => {
                const reminderMessage = `⚠️ *Reminder for ${day}*\n *Class at ${entry.time}*\n*${entry.subject}*\n*Room:* ${entry.room}\n\nGet ready!`;
                sendMessageWithRetry(reminderMessage);
            });

            // Class Start Message
            cron.schedule(cronTime, () => {
                const classMessage = ` ${day}*\n *${entry.time}*\n *${entry.subject}*\n *Room:* ${entry.room}`;
                sendMessageWithRetry(classMessage);
            });

            console.log(`⏳ Scheduled: ${entry.subject} on ${day} at ${entry.time} (Reminder at ${hour}:${reminderMinute})`);
        });
    });
}


client.on('qr', qr => {
    console.log("Scan this QR Code in WhatsApp");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("Bot is ready!");
    scheduleClassReminders();
});


client.on('disconnected', async (reason) => {
    console.error(`❌ Bot disconnected: ${reason}`);
    console.log("Restarting WhatsApp Web in 10 seconds...");
    await new Promise(res => setTimeout(res, 10000));
    client.destroy();
    client.initialize();
});


client.initialize();
