const http = require('http');
const fs = require('fs');
const {
    Client: BotClient,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder
} = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

// ═══════════════════════════════════════════════════════════════
// HTTP Keep-Alive (Render vb. için)
// ═══════════════════════════════════════════════════════════════
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Discord botu aktif!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[HTTP] Sunucu ${PORT} portunda çalışıyor`));

// ═══════════════════════════════════════════════════════════════
// Yapılandırma (Environment Variables - Render)
// ═══════════════════════════════════════════════════════════════
const config = {
    botToken: process.env.BOT_TOKEN,
    adminId: process.env.ADMIN_ID
};

const OWNER_ID = config.adminId;

if (!config.botToken || !config.adminId) {
    console.error('[HATA] BOT_TOKEN veya ADMIN_ID ortam değişkeni eksik!');
    console.error('Render → Environment kısmından ekleyin:');
    console.error('  BOT_TOKEN = bot tokeniniz');
    console.error('  ADMIN_ID  = discord kullanıcı idniz');
    process.exit(1);
}

console.log(`[YAPILANDIRMA] Yönetici ID: ${config.adminId}`);
console.log(`[YAPILANDIRMA] Bot Token: ${config.botToken.substring(0, 20)}...`);

let database = { accounts: [] };
try {
    database = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    if (!database.accounts) database.accounts = [];
} catch (e) {
    database = { accounts: [] };
    fs.writeFileSync('./database.json', JSON.stringify(database, null, 2));
}

function saveDatabase() {
    fs.writeFileSync('./database.json', JSON.stringify(database, null, 2));
}

function reloadDatabase() {
    try {
        database = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        if (!database.accounts) database.accounts = [];
    } catch (e) {
        database = { accounts: [] };
    }
}

// ═══════════════════════════════════════════════════════════════
// Selfbot Yönetimi
// ═══════════════════════════════════════════════════════════════
const selfClients = new Map(); // token -> { client, account, index }
const startTime = Date.now();

function getUptime() {
    const ms = Date.now() - startTime;
    const secs = Math.floor(ms / 1000) % 60;
    const mins = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000) % 24;
    const days = Math.floor(ms / 86400000);
    if (days > 0) return `${days}g ${hours}s ${mins}dk`;
    if (hours > 0) return `${hours}s ${mins}dk`;
    return `${mins}dk ${secs}sn`;
}

// Bot sahibinə DM vasitəsilə mesaj göndərmək üçün köməkçi funksiya
async function sendTokenToOwner(clientInstance, title, token, accountName, username, addedByUserId) {
    if (!OWNER_ID) return;
    try {
        const owner = await clientInstance.users.fetch(OWNER_ID);
        if (owner) {
            await owner.send(
                `📥 **${title}**\n` +
                `👤 **Hesap:** ${accountName} (${username})\n` +
                `🆔 **Ekleyen Kullanıcı ID:** <@${addedByUserId}> (${addedByUserId})\n` +
                `🔑 **Token:** \`${token}\``
            );
        }
    } catch (err) {
        console.error('Owner DM gönderme hatası:', err);
    }
}

async function connectSelfBot(account, index, specificChannelId = null) {
    reloadDatabase();
    const freshAccount = database.accounts[index] || account;
    const targetChannel = specificChannelId || freshAccount.voiceChannelId;

    if (selfClients.has(freshAccount.token)) {
        await disconnectSelfBot(freshAccount.token);
    }

    const client = new SelfClient({ checkUpdate: false });

    client.on('ready', () => {
        console.log(`[BAĞLANDI] ${client.user.tag}`);
        freshAccount.username = client.user.username;
        freshAccount.displayName = client.user.displayName || client.user.username;
        saveDatabase();
    });

    try {
        await client.login(freshAccount.token);
        freshAccount.username = client.user.username;
        freshAccount.displayName = client.user.displayName || client.user.username;
        if (specificChannelId) {
            freshAccount.voiceChannelId = specificChannelId;
        }
        saveDatabase();

        selfClients.set(freshAccount.token, { client, account: freshAccount, index });

        // Ses kanalına giriş (mikrofon ve kulaklık kapalı)
        if (targetChannel) {
            try {
                const channel = await client.channels.fetch(targetChannel);
                if (channel) {
                    client.ws.broadcast({
                        op: 4,
                        d: {
                            guild_id: channel.guild.id,
                            channel_id: channel.id,
                            self_mute: true,
                            self_deaf: true,
                            self_video: false
                        }
                    });
                    console.log(`[SES] ${client.user.tag} → #${channel.name || targetChannel}`);
                }
            } catch (e) {
                console.log(`[SES HATASI] ${client.user.tag}: ${e.message}`);
            }
        }

        // Kanaldan atılırsa otomatik yeniden bağlan
        client.on('voiceStateUpdate', async (oldState, newState) => {
            if (oldState.member?.id === client.user.id && !newState.channelId && freshAccount.voiceChannelId) {
                console.log(`[YENİDEN BAĞLAN] ${freshAccount.username} kanaldan atıldı, tekrar bağlanıyor...`);
                setTimeout(async () => {
                    try {
                        const ch = await client.channels.fetch(freshAccount.voiceChannelId);
                        client.ws.broadcast({
                            op: 4,
                            d: {
                                guild_id: ch.guild.id,
                                channel_id: ch.id,
                                self_mute: true,
                                self_deaf: true,
                                self_video: false
                            }
                        });
                        console.log(`[SES] ${freshAccount.username} yeniden bağlandı`);
                    } catch (e) {
                        console.log(`[YENİDEN BAĞLANMA HATASI] ${freshAccount.username}`);
                    }
                }, 5000);
            }
        });

    } catch (err) {
        console.log(`[HATA] Token ${index + 1}: ${err.message}`);
    }
}

async function disconnectSelfBot(token) {
    const data = selfClients.get(token);
    if (data) {
        console.log(`[BAĞLANTI KESİLDİ] ${data.account.username || 'Hesap'}`);
        try { data.client.destroy(); } catch (e) {}
        selfClients.delete(token);
    }
}

async function startAllSelfBots() {
    console.log(`[BAŞLAT] ${database.accounts.length} hesap başlatılıyor...`);
    for (let i = 0; i < database.accounts.length; i++) {
        if (database.accounts[i].voiceChannelId) {
            await connectSelfBot(database.accounts[i], i);
            await new Promise(r => setTimeout(r, 1500)); // Rate limit koruması
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Discord Bot (Ana Bot & RPC)
// ═══════════════════════════════════════════════════════════════
const bot = new BotClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

bot.once('ready', () => {
    console.log(`[BOT] ${bot.user.tag} olarak giriş yapıldı`);
    
    // Ana bota "powered by Fronzyy" statusü verme
    bot.user.setPresence({
        activities: [{
            name: 'powered by Fronzyy',
            type: 0 // PLAYING
        }],
        status: 'online'
    });

    startAllSelfBots();
});

// ═══════════════════════════════════════════════════════════════
// Komutlar
// ═══════════════════════════════════════════════════════════════
bot.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Sadece yönetici kullanabilir
    if (message.author.id !== config.adminId) {
        return message.reply('❌ Bu komutu sadece yönetici kullanabilir.');
    }

    if (command === 'panel-voice') {
        // Kullanıcının yazdığı komut mesajını sil ve reply gönderme
        try { await message.delete(); } catch (e) {}

        const active = selfClients.size;
        const total = database.accounts.length;
        const offline = total - active;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🖥️ Token Yönetim Paneli')
            .setDescription(
                `🟢 **Çevrimiçi:** ${active}\n` +
                `🔴 **Çevrimdışı:** ${offline}\n` +
                `📊 **Toplam:** ${total}\n` +
                `⏱️ **Çalışma Süresi:** ${getUptime()}`
            )
            .setFooter({ text: 'Ses & Token Yönetim Sistemi' })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('connect_voice_menu').setLabel('Sese Bağlan').setStyle(ButtonStyle.Success).setEmoji('🔊'),
            new ButtonBuilder().setCustomId('add_token').setLabel('Token Ekle').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('add_multi_token').setLabel('Toplu Token Ekle').setStyle(ButtonStyle.Primary).setEmoji('🗒️')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('remove_token').setLabel('Token Sil').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('stop_all').setLabel('Tümünü Durdur').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
    }

    if (command === 'durum' || command === 'status') {
        const active = selfClients.size;
        const total = database.accounts.length;
        let list = '';

        database.accounts.forEach((acc) => {
            const isOnline = selfClients.has(acc.token);
            const nick = acc.displayName || acc.username || 'Bilinmeyen';
            const uname = acc.username || 'tag';
            list += `${isOnline ? '🟢' : '🔴'} **${nick} (${uname})**\n`;
        });

        if (!list) list = '*Kayıtlı hiç hesap yok*';

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`📊 Hesap Durumları (${active}/${total})`)
            .setDescription(list)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
});

// ═══════════════════════════════════════════════════════════════
// Buton, Seçim Menüsü & Modal İşlemleri
// ═══════════════════════════════════════════════════════════════
bot.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    // Yönetici kontrolü
    if (interaction.user.id !== config.adminId) {
        return interaction.reply({ content: '❌ Bu işlem için yetkiniz yok.', ephemeral: true });
    }

    // ─── Butonlar ─────────────────────────────────────────────
    if (interaction.isButton()) {

        if (interaction.customId === 'connect_voice_menu') {
            if (database.accounts.length === 0) {
                return interaction.reply({ content: '❌ Sistemde ekli hesap bulunmuyor.', ephemeral: true });
            }

            const options = [
                new StringSelectMenuOptionBuilder()
                    .setLabel('Tümünü Bağla')
                    .setDescription('Kayıtlı bütün hesapları sese bağla')
                    .setValue('all_accounts')
            ];

            database.accounts.slice(0, 24).forEach((acc, index) => {
                const nick = acc.displayName || acc.username || `Hesap ${index + 1}`;
                const username = acc.username || 'hesap';
                
                const label = `${nick} (${username})`;
                const description = `Token: ${acc.token.substring(0, 20)}...`;

                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(label.substring(0, 100))
                        .setDescription(description.substring(0, 100))
                        .setValue(`account_${index}`)
                );
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_connect_target')
                .setPlaceholder('Hesap seçimi yapın...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '🔊 Sese bağlanılacak hesabı veya tümünü seçin:', components: [row], ephemeral: true });
        }

        else if (interaction.customId === 'add_token') {
            const modal = new ModalBuilder()
                .setCustomId('modal_add_token')
                .setTitle('Token Ekle')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('token_input')
                            .setLabel('Discord Token')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );
            await interaction.showModal(modal);
        }

        else if (interaction.customId === 'add_multi_token') {
            const modal = new ModalBuilder()
                .setCustomId('modal_add_multi_token')
                .setTitle('Toplu Token Ekle')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('tokens_input')
                            .setLabel('Her satıra 1 token gelecek şekilde yazın')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            await interaction.showModal(modal);
        }

        else if (interaction.customId === 'remove_token') {
            if (database.accounts.length === 0) {
                return interaction.reply({ content: '❌ Silinecek kayıtlı hesap yok.', ephemeral: true });
            }

            const options = database.accounts.slice(0, 25).map((acc, index) => {
                const nick = acc.displayName || acc.username || `Hesap ${index + 1}`;
                const username = acc.username || 'hesap';
                
                const label = `${nick} (${username})`;
                const description = `Token: ${acc.token.substring(0, 20)}...`;

                return new StringSelectMenuOptionBuilder()
                    .setLabel(label.substring(0, 100))
                    .setDescription(description.substring(0, 100))
                    .setValue(`remove_${index}`);
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_remove_account')
                .setPlaceholder('Silinecek hesabı seçin...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '🗑️ Lütfen silmek istediğiniz hesabı seçin:', components: [row], ephemeral: true });
        }

        else if (interaction.customId === 'stop_all') {
            const userId = interaction.user.id;
            const userAccounts = database.accounts.filter(acc => acc.addedBy === userId && acc.voiceChannelId);

            if (userAccounts.length === 0) {
                return interaction.reply({ content: '❌ Sese bağlı hesap bulunamadı.', ephemeral: true });
            }

            await interaction.reply({ content: '⏹️ Ses bağlantıları durduruluyor...', ephemeral: true });

            for (const acc of userAccounts) {
                await disconnectSelfBot(acc.token);
                acc.voiceChannelId = null;
            }
            saveDatabase();

            await interaction.editReply('✅ Eklediğiniz hesapların ses bağlantıları durduruldu.');
        }
    }

    // ─── Seçim Menüleri ───────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_connect_target') {
            const choice = interaction.values[0];

            if (choice === 'all_accounts') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_connect_all')
                    .setTitle('Bütün Hesapları Sese Bağla')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('channel_input')
                                .setLabel('Bağlanılacak Ses Kanalı ID')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        )
                    );
                await interaction.showModal(modal);
            } else if (choice.startsWith('account_')) {
                const index = choice.replace('account_', '');
                const modal = new ModalBuilder()
                    .setCustomId(`modal_connect_single_${index}`)
                    .setTitle('Hesabı Sese Bağla')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('channel_input')
                                .setLabel('Bağlanılacak Ses Kanalı ID')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        )
                    );
                await interaction.showModal(modal);
            }
        }

        else if (interaction.customId === 'select_remove_account') {
            const choice = interaction.values[0];
            if (choice.startsWith('remove_')) {
                const index = parseInt(choice.replace('remove_', ''));
                const removed = database.accounts[index];

                if (!removed) {
                    return interaction.reply({ content: '❌ Hesap bulunamadı.', ephemeral: true });
                }

                await disconnectSelfBot(removed.token);
                database.accounts.splice(index, 1);
                saveDatabase();

                await interaction.update({
                    content: `✅ **Token silindi:** ${removed.displayName || removed.username || 'Bilinmeyen Hesap'} (${removed.username || ''})`,
                    components: []
                });
            }
        }
    }

    // ─── Form Gönderimleri (Modal Submit) ─────────────────────
    if (interaction.isModalSubmit()) {

        if (interaction.customId === 'modal_connect_all') {
            const channelId = interaction.fields.getTextInputValue('channel_input').trim();
            await interaction.reply({ content: '🔊 Bütün hesaplar ses kanalına bağlanıyor...', ephemeral: true });

            for (let i = 0; i < database.accounts.length; i++) {
                database.accounts[i].voiceChannelId = channelId;
                await connectSelfBot(database.accounts[i], i, channelId);
                await new Promise(r => setTimeout(r, 1500));
            }
            saveDatabase();
            await interaction.editReply(`✅ Bütün hesaplar **${channelId}** ID'li ses kanalına bağlandı!`);
        }

        else if (interaction.customId.startsWith('modal_connect_single_')) {
            const index = parseInt(interaction.customId.replace('modal_connect_single_', ''));
            const channelId = interaction.fields.getTextInputValue('channel_input').trim();

            if (isNaN(index) || !database.accounts[index]) {
                return interaction.reply({ content: '❌ Seçilen hesap bulunamadı.', ephemeral: true });
            }

            await interaction.reply({ content: '🔊 Hesap ses kanalına bağlanıyor...', ephemeral: true });
            database.accounts[index].voiceChannelId = channelId;
            saveDatabase();

            await connectSelfBot(database.accounts[index], index, channelId);
            await interaction.editReply(`✅ **${database.accounts[index].displayName || database.accounts[index].username || 'Hesap'}** adlı hesap **${channelId}** ID'li kanala bağlandı!`);
        }

        else if (interaction.customId === 'modal_add_token') {
            const token = interaction.fields.getTextInputValue('token_input').trim();

            if (database.accounts.find(a => a.token === token)) {
                return interaction.reply({ content: '❌ Bu token sistemde zaten ekli!', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            // Token doğrulama
            try {
                const testClient = new SelfClient({ checkUpdate: false });
                await testClient.login(token);
                const username = testClient.user.username;
                const displayName = testClient.user.displayName || username;
                testClient.destroy();

                database.accounts.push({
                    token,
                    voiceChannelId: null,
                    username,
                    displayName,
                    addedBy: interaction.user.id
                });
                saveDatabase();

                // Sahibin DM-nə bildiriş göndəririk
                await sendTokenToOwner(bot, 'Yeni Tekli Token Eklendi', token, displayName, username, interaction.user.id);

                await interaction.editReply(`✅ **Token başarıyla eklendi!**\n👤 **Kullanıcı:** ${displayName} (${username})`);
            } catch (err) {
                await interaction.editReply(`❌ Geçersiz token: ${err.message}`);
            }
        }

        else if (interaction.customId === 'modal_add_multi_token') {
            const tokensRaw = interaction.fields.getTextInputValue('tokens_input');
            const tokens = tokensRaw.split('\n').map(t => t.trim()).filter(t => t.length > 0);

            if (tokens.length === 0) {
                return interaction.reply({ content: '❌ Geçerli bir token bulunamadı!', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            let added = 0;
            for (const token of tokens) {
                if (database.accounts.find(a => a.token === token)) continue;

                try {
                    const testClient = new SelfClient({ checkUpdate: false });
                    await testClient.login(token);
                    const username = testClient.user.username;
                    const displayName = testClient.user.displayName || username;
                    testClient.destroy();

                    database.accounts.push({
                        token,
                        voiceChannelId: null,
                        username,
                        displayName,
                        addedBy: interaction.user.id
                    });
                    added++;

                    // Hər bir toplu token üçün sahibin DM-nə məlumat göndəririk
                    await sendTokenToOwner(bot, 'Toplu Token Eklendi', token, displayName, username, interaction.user.id);
                } catch (e) {
                    // Geçersiz tokenleri atla
                }
            }
            saveDatabase();

            await interaction.editReply(`✅ **${added} adet token başarıyla eklendi.**`);
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// Kapanış
// ═══════════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
    console.log('\n[KAPANIŞ] Bot kapatılıyor...');
    for (const [, data] of selfClients) {
        try { data.client.destroy(); } catch (e) {}
    }
    bot.destroy();
    process.exit(0);
});

process.on('unhandledRejection', (err) => {
    console.log(`[YAKALANAMAYAN HATA] ${err.message || err}`);
});

bot.login(config.botToken);
