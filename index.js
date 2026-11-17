import { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  StringSelectMenuBuilder,
  ActivityType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
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

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# **Fronzyy Spam Botu**')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Nasıl kullanılır?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **Spamı Başlat** : Kanal ID-sini girin ve saniye aralığını yazarak spamı başlatır.')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **Token Ekle** : Tekli token eklemenizi sağlar.')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **Toplu Token Ekle** : Her satıra bir token yazarak birden fazla hesabı aynı anda eklersiniz.')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **Token Sil** : Eklediğiniz tokenleri tek tek veya tümünü silebilirsiniz.')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **Tümünü Durdur** : Aktif olan tüm spam süreçlerini durdurur.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Copyright © Developed by Fronzyy 2026`)
      );

    // Birinci sıra düymələr (Spamı Başlat, Token Ekle, Toplu Token Ekle)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_spam')
        .setLabel('Spamı Başlat')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🪧'),

      new ButtonBuilder()
        .setCustomId('add_token')
        .setLabel('Token Ekle')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),

      new ButtonBuilder()
        .setCustomId('add_bulk_token')
        .setLabel('Toplu Token Ekle')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🗒️')
    );

    // İkinci sıra düymələr (Token Sil, Tümünü Durdur)
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('remove_token_panel')
        .setLabel('Token Sil')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),

      new ButtonBuilder()
        .setCustomId('stop_all')
        .setLabel('Tümünü Durdur')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️')
    );

    await message.channel.send({ 
      components: [container, row1, row2],
      flags: MessageFlags.IsComponentsV2 
    });
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

  // --- 1.1. TOPLU TOKEN EKLE BUTONU ---
  if (interaction.isButton() && interaction.customId === 'add_bulk_token') {
    const modal = new ModalBuilder()
      .setCustomId('bulk_token_modal')
      .setTitle('Toplu Discord Token Ekle');

    const tokenInput = new TextInputBuilder()
      .setCustomId('bulk_token_input')
      .setLabel('Discord Tokenlerini girin')
      .setPlaceholder('Her satıra 1 token gelecek şekilde yazın')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(tokenInput);
    modal.addComponents(firstRow);

    await interaction.showModal(modal);
  }

  // --- 1.2. TOKEN SİL PANELİ (SEÇİM MENÜSÜ) ---
  if (interaction.isButton() && interaction.customId === 'remove_token_panel') {
    const tokens = userTokens.get(userId);
    if (!tokens || tokens.length === 0) {
      return interaction.reply({ content: '⚠️ Silinecek kayıtlı hesabınız bulunmuyor!', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_remove_account')
      .setPlaceholder('Silmek istediğiniz hesabı seçin...')
      .addOptions([
        { label: 'Bütün Tokenleri Sil', value: 'clear_all_tokens', description: 'Size ait olan bütün tokenleri sistemden siler', emoji: '🗑️' },
        ...tokens.map((t, index) => ({
          label: `${t.name} (${t.username})`,
          value: index.toString(),
          description: `Bu hesabı sil`,
          emoji: '❌'
        }))
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: 'Silmek istediğiniz hesabı veya seçeneği belirleyin:', components: [row], ephemeral: true });
  }

  // --- 2. TEK TOKEN MODAL CEVABI ---
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

  // --- 2.1. TOPLU TOKEN MODAL CEVABI ---
  if (interaction.isModalSubmit() && interaction.customId === 'bulk_token_modal') {
    const rawInput = interaction.fields.getTextInputValue('bulk_token_input').trim();
    const tokens = rawInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);

    if (tokens.length === 0) {
      return interaction.reply({ content: '❌ Geçerli token bulunamadı!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (!userTokens.has(userId)) {
      userTokens.set(userId, []);
    }
    const existingList = userTokens.get(userId);

    let successCount = 0;
    let failCount = 0;
    let addedNames = [];

    for (const token of tokens) {
      if (existingList.some(t => t.token === token)) continue;

      try {
        const userRes = await fetch('https://discord.com/api/v9/users/@me', {
          headers: { 'Authorization': token }
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          const globalName = userData.global_name || userData.username;
          const username = userData.username;

          existingList.push({ token, name: globalName, username: username });
          addedNames.push(`${globalName} (${username})`);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    await interaction.editReply({ 
      content: `📦 **Toplu Token İşlemi Tamamlandı!**\n✅ Başarıyla eklenen: **${successCount}** hesap\n❌ Geçersiz/Eklenemeyen: **${failCount}**\n\n${addedNames.length > 0 ? 'Eklenenler:\n- ' + addedNames.join('\n- ') : ''}` 
    });
  }

  // --- 2.2. TOKEN SİLME SEÇİM İŞLEMİ ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_remove_account') {
    const selectedValue = interaction.values[0];
    const tokens = userTokens.get(userId);

    if (!tokens) {
      return interaction.reply({ content: '❌ Kayıtlı hesabınız bulunmuyor.', ephemeral: true });
    }

    if (selectedValue === 'clear_all_tokens') {
      userTokens.set(userId, []);
      return interaction.reply({ content: '🗑️ Size ait olan bütün tokenler başarıyla silindi!', ephemeral: true });
    } else {
      const index = parseInt(selectedValue);
      const removedAccount = tokens.splice(index, 1)[0];
      return interaction.reply({ content: `❌ Başarıyla silindi: **${removedAccount.name} (${removedAccount.username})**`, ephemeral: true });
    }
  }

  // --- 3. SPAMI BAŞLAT BUTONU ---
  if (interaction.isButton() && interaction.customId === 'start_spam') {
    const tokens = userTokens.get(userId);
    if (!tokens || tokens.length === 0) {
      return interaction.reply({ content: '⚠️ Önce "Token Ekle" veya "Toplu Token Ekle" butonundan bir hesap eklemelisiniz!', ephemeral: true });
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

  // --- 6. TÜMÜNÜ DURDUR BUTONU ---
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
