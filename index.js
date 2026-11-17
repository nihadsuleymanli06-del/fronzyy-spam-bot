import { 
    Client as BotClient, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags,
    AttachmentBuilder,
    EmbedBuilder
} from 'discord.js';
import express from 'express';

// --- RENDER UPTIME ÜÇÜN EXPRESS SERVERİ ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Fronzyy Bots Afk-Ses Sistemi aktif ve çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Uptime sunucusu ${PORT} portunda çalışıyor.`);
});
// ----------------------------------------

const bot = new BotClient({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

bot.on('ready', async () => {
    console.log(`Bot başarıyla giriş yaptı: ${bot.user.tag}`);
    
    // Bot durumunu ayarla
    bot.user.setPresence({
        activities: [{
            name: 'powered by swénzy',
            type: 0 // PLAYING
        }],
        status: 'online'
    });
});

bot.on('messageCreate', async (message) => {
    // Bot mesajlarını ignore et
    if (message.author.bot) return;
    
    if (message.content === '!panel') {
        try {
            const container = new ContainerBuilder()
                .setAccentColor(0x36393F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('# **Fronzyy Bots Afk-Ses Sistemi**')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### **👋 Merhaba! Fronzyy Bots Üyeleri**\n\n` +
                        `\`\`\`ansi\n\u001b[1;33m• Kendi kadromuza özel herkese bir sistem!\n• Ses afklığınızı kolayca artırın!\u001b[0m\n\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### **⚡ Ne işe yarar?**\n\n` +
                        `\`\`\`ansi\n\u001b[1;32m• Ses aktifliği kazanırsınız!\n• AFK kalırken aktif görünürsünüz!\n• Tamamen otomatik çalışır!\u001b[0m\n\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### **⚙️ Nasıl çalışır?**\n\n` +
                        `\`\`\`ansi\n\u001b[1;34m• Bota bilgilerini gir\n• Token ve Kanal ID yaz\n• Görseldeki gibi doldur\u001b[0m\n\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### **🎁 Paket Sistemi**\n` +
                        `\`\`\`ansi\n\u001b[1;32m• Herkes limit hakkına sahiptir!\n• Admin limitsiz kullanabilir!\u001b[0m\n\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### 📝 Ek Bilgiler\n\n` +
                        `\`\`\`ansi\n` +
                        `\u001b[1;35m• Paketler otomatik aktif edilir!\n` +
                        `• Limit dolunca sistem durur!\n` +
                        `• Yetkililer limitsiz kullanabilir!\u001b[0m\n` +
                        `\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### 🔒 Güvenlik\n` +
                        `\`\`\`ansi\n` +
                        `\u001b[0;34m**Veriler AES şifreleme ile saklanmaktadır**\n` +
                        `**Paylaşılmaz**\u001b[0m\n` +
                        `\`\`\``
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('panel_v2_token_ekle').setLabel('1 Token Ekle').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('panel_v2_toplu_token').setLabel('Toplu Token Ekle').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
                        new ButtonBuilder().setCustomId('panel_v2_kaldir').setLabel('Kaldır').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                        new ButtonBuilder().setCustomId('panel_v2_hesaplar').setLabel('Hesaplarım').setStyle(ButtonStyle.Primary).setEmoji('👤')
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Copyright © Developed by Fronzyy 2026`
                    )
                );
            
            await message.channel.send({ 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (err) {
            console.log('[ERROR] Panel hatası:', err);
            await message.reply('❌ Panel oluşturulurken hata: ' + err.message);
        }
    }
});

bot.login(process.env.DISCORD_TOKEN);
