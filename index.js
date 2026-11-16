import { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  StringSelectMenuBuilder 
} from 'discord.js';
import express from 'express';

// --- UPTIME VƏ PORT ÜÇÜN EXPRESS SERVERİ ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Fronzyy Spam Botu aktif ve çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
// -------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bellekte saklanan tokenler ve aktif spam süreçleri
const userTokens = new Map();
const activeSpams = new Map();

client.once('ready', () => {
  console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// !panel komutu
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!panel') {
    const embed = new EmbedBuilder()
      .setTitle('# Fronzyy Spam Botu')
      .setDescription(
        '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n' +
        '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n\n' +
        '**Nasıl kullanılır**\n\n' +
        '**Spamı Başlat** : Eğer token eklediyseniz tuşa basıldığında kanal ID-sini girin ve saniye aralığını yazarak spamı başlatır.\n\n' +
        '**Token Ekle** : Tokeni yazarak hesabınızı eklersiniz.\n\n' +
        '**Tümünü Kapat** : Size ait tokenlerdeki tüm spamlar durdurulur.'
      )
      .setColor('#5865F2');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_spam')
        .setLabel('Spamı Başlat')
        .setStyle(ButtonStyle.Success), // Yeşil

      new ButtonBuilder()
        .setCustomId('add_token')
        .setLabel('Token Ekle')
        .setStyle(ButtonStyle.Success), // Yeşil

      new ButtonBuilder()
        .setCustomId('stop_all')
        .setLabel('Tümünü Kapat')
        .setStyle(ButtonStyle.Danger) // Kırmızı
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// Buton ve Modal etkileşimleri
client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;

  // --- 1. TOKEN EKLE BUTONU ---
  if (interaction.isButton() && interaction.customId === 'add_token') {
    const modal = new ModalBuilder()
      .setCustomId('token_modal')
      .setTitle('Discord Token Ekle');

    const tokenInput = new TextInputBuilder()
      .setCustomId('token_input')
      .setLabel('Discord Tokeninizi girin')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(tokenInput);
    modal.addComponents(firstRow);

    await interaction.showModal(modal);
  }

  // --- 2. TOKEN MODAL CEVABI ---
  if (interaction.isModalSubmit() && interaction.customId === 'token_modal') {
    const token = interaction.fields.getTextInputValue('token_input');

    const testClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    
    try {
      await testClient.login(token);
      const accountName = testClient.user.tag;
      testClient.destroy();

      if (!userTokens.has(userId)) {
        userTokens.set(userId, []);
      }
      
      userTokens.get(userId).push({ token, name: accountName });

      await interaction.reply({ content: `✅ Başarıyla eklendi! Hesap: **${accountName}**`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Hata: Girilen token geçersiz veya devre dışı bırakılmış.`, ephemeral: true });
    }
  }

  // --- 3. SPAMI BAŞLAT BUTONU ---
  if (interaction.isButton() && interaction.customId === 'start_spam') {
    const tokens = userTokens.get(userId);
    if (!tokens || tokens.length === 0) {
      return interaction.reply({ content: '⚠️ Önce "Token Ekle" butonundan bir hesap eklemelisiniz!', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_account')
      .setPlaceholder('Hesap seçin...')
      .addOptions([
        { label: 'Bütün Hesaplar', value: 'all_accounts', description: 'Eklediğiniz bütün hesaplar spam yapacak' },
        ...tokens.map((t, index) => ({
          label: t.name,
          value: index.toString(),
          description: `Token ID: ...${t.token.slice(-6)}`
        }))
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: 'Spam yapmak istediğiniz hesabı seçin:', components: [row], ephemeral: true });
  }

  // --- 4. HESAP SEÇİLDİKTEN SONRA KANAL VE SİNYAL TALEBİ ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_account') {
    const selectedValue = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`spam_modal_${selectedValue}`)
      .setTitle('Spam Ayarları');

    const channelInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel('Spam yapılacak Kanalın ID-si')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId('spam_interval')
      .setLabel('Kaç saniyede bir? (örn: 3)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const messageInput = new TextInputBuilder()
      .setCustomId('spam_message')
      .setLabel('Spam yapılacak mesaj')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(timeInput),
      new ActionRowBuilder().addComponents(messageInput)
    );

    await interaction.showModal(modal);
  }

  // --- 5. SPAM BAŞLANGICI (MODAL SUBMIT) ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith('spam_modal_')) {
    const selectedValue = interaction.customId.replace('spam_modal_', '');
    const channelId = interaction.fields.getTextInputValue('channel_id');
    const intervalSec = parseFloat(interaction.fields.getTextInputValue('spam_interval'));
    const spamText = interaction.fields.getTextInputValue('spam_message');

    if (isNaN(intervalSec) || intervalSec <= 0) {
      return interaction.reply({ content: '❌ Geçersiz saniye değeri girdiniz!', ephemeral: true });
    }

    const tokens = userTokens.get(userId);
    let targetTokens = [];

    if (selectedValue === 'all_accounts') {
      targetTokens = tokens;
    } else {
      targetTokens = [tokens[parseInt(selectedValue)]];
    }

    await interaction.reply({ content: `🚀 Seçilen ${targetTokens.length} hesap ile spam başlatıldı!`, ephemeral: true });

    if (!activeSpams.has(userId)) {
      activeSpams.set(userId, []);
    }

    for (const tObj of targetTokens) {
      const spamClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
      
      try {
        await spamClient.login(tObj.token);
        
        const interval = setInterval(async () => {
          try {
            const channel = await spamClient.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
              await channel.send(spamText);
            }
          } catch (err) {
            console.error(`Spam hatası (${tObj.name}):`, err.message);
          }
        }, intervalSec * 1000);

        activeSpams.get(userId).push({ client: spamClient, interval });
      } catch (err) {
        console.error(`Token giriş hatası:`, err.message);
      }
    }
  }

  // --- 6. TÜMÜNÜ KAPAT BUTONU ---
  if (interaction.isButton() && interaction.customId === 'stop_all') {
    const userSpams = activeSpams.get(userId);
    
    if (!userSpams || userSpams.length === 0) {
      return interaction.reply({ content: 'ℹ️ Aktif spam süreciniz bulunmuyor.', ephemeral: true });
    }

    for (const item of userSpams) {
      clearInterval(item.interval);
      try {
        item.client.destroy();
      } catch (e) {}
    }

    activeSpams.set(userId, []);
    await interaction.reply({ content: '🛑 Hesaplarınızdaki bütün aktif spamlar durduruldu.', ephemeral: true });
  }
});

// Render Environment üzerinden gelen DISCORD_TOKEN ile başlatılır
client.login(process.env.DISCORD_TOKEN);
