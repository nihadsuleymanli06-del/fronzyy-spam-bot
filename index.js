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
  StringSelectMenuBuilder,
  ActivityType 
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
  
  // Botun statusunu "powered by Fronzyy" olaraq təyin edirik
  client.user.setActivity({
    name: 'powered by Fronzyy',
    type: ActivityType.Playing
  });
});

// !panel-spam komutu (Yanıt olarak değil, doğrudan kanala gönderir)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!panel-spam') {
    try { await message.delete(); } catch (e) {}

    // Online kullanıcı sayısı (token eklemiş benzersiz kullanıcılar)
    const onlineCount = userTokens.size;

    const embed = new EmbedBuilder()
      .setColor('#2b2d31') // Sol kenar çizgisi rengi
      .setDescription(
        '# Fronzyy Spam Botu\n' +
        '────────────────────────────────────────\n' +
        '## Nasıl kullanılır?\n\n' +
        '• **Spamı Başlat** : Eğer token eklediyseniz tuşa basıldığında kanal ID-sini girin ve saniye aralığını yazarak spamı başlatır.\n\n' +
        '• **Token Ekle** : Tokeni yazarak hesabınızı eklersiniz.\n\n' +
        '• **Tümünü Kapat** : Size ait tokenlerdeki tüm spamlar durdurulur.\n\n' +
        '────────────────────────────────────────\n' +
        `-# Online: ${onlineCount} | Copyright © Developed by Fronzyy 2026`
      );

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

    await message.channel.send({ embeds: [embed], components: [row] });
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
    const token = interaction.fields.getTextInputValue('token_input').trim();

    await interaction.deferReply({ ephemeral: true });

    try {
      const userRes = await fetch('https://discord.com/api/v9/users/@me', {
        headers: { 'Authorization': token }
      });

      if (!userRes.ok) {
        return interaction.editReply({ content: `❌ Hata: Girilen token geçersiz veya devre dışı bırakılmış.` });
      }

      const userData = await userRes.json();
      const globalName = userData.global_name || userData.username;
      const username = userData.username;

      if (!userTokens.has(userId)) {
        userTokens.set(userId, []);
      }
      
      const existingList = userTokens.get(userId);
      if (!existingList.some(t => t.token === token)) {
        existingList.push({ token, name: globalName, username: username });
      }

      await interaction.editReply({ content: `✅ Başarıyla eklendi! Hesap: **${globalName} (${username})**` });
    } catch (err) {
      await interaction.editReply({ content: `❌ Token eklenirken bir hata oluştu.` });
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
          label: `${t.name} (${t.username})`,
          value: index.toString(),
          description: `Seçilen hesap: ${t.name}`
        }))
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: 'Spam yapmak istediğiniz hesabı seçin:', components: [row], ephemeral: true });
  }

  // --- 4. HESAP SEÇİLDİKTEN SONRA KANAL VE SÜRE TALEBİ ---
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
    const channelId = interaction.fields.getTextInputValue('channel_id').trim();
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
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': tObj.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: spamText })
          });

          if (!response.ok) {
            console.error(`Spam hatası (${tObj.name}): HTTP ${response.status}`);
          }
        } catch (err) {
          console.error(`Spam bağlantı hatası (${tObj.name}):`, err.message);
        }
      }, intervalSec * 1000);

      activeSpams.get(userId).push({ interval });
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
    }

    activeSpams.set(userId, []);
    await interaction.reply({ content: '🛑 Hesaplarınızdaki bütün aktif spamlar durduruldu.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
