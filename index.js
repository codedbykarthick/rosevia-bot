const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Constants
const CATEGORY_ID = '1389516515971170395';
const ADMIN_ROLE_ID = '1389516588205735996';
const CASH_EMOJI = { id: '1389922470168887306', name: 'Cashapp' };
const BANNER_IMAGE = 'https://cdn.discordapp.com/attachments/1389920703259873290/1389921008840081408/668fbc560f8ed6375b9f5f92aa59d3cd.gif';

// Bot Ready
client.once('ready', () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

// Ticket Panel Command
client.on('messageCreate', async (msg) => {
  if (msg.content === '!ticket' && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle('🛍️ Rosevia Service Center')
      .setDescription(
        'Welcome to the Rosevia Storefront! Select a service below to open a ticket.\n\n' +
        '**By opening a ticket, you agree to our TOS:**\n' +
        '• No refunds after delivery\n' +
        '• 1 free revision\n' +
        '• Chargebacks = ban\n' +
        '• Ticket closure = service accepted'
      )
      .setImage(BANNER_IMAGE)
      .setColor('#2B2D31');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_type')
      .setPlaceholder('Choose a service')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed')
          .setValue('embed')
          .setDescription('To purchase a custom embed, click here.')
          .setEmoji(CASH_EMOJI),
        new StringSelectMenuOptionBuilder()
          .setLabel('Logo')
          .setValue('logo')
          .setDescription('To purchase a logo, click here.')
          .setEmoji(CASH_EMOJI),
        new StringSelectMenuOptionBuilder()
          .setLabel('Server Setup')
          .setValue('setup')
          .setDescription('To purchase a full server setup, click here.')
          .setEmoji(CASH_EMOJI)
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await msg.channel.send({ embeds: [embed], components: [row] });
  }
});

// Dropdown Handler
client.on('interactionCreate', async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    const type = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;

    // Check if user already has an open ticket
    const existing = guild.channels.cache.find(
      c =>
        c.parentId === CATEGORY_ID &&
        c.permissionOverwrites.cache.has(user.id) &&
        c.permissionOverwrites.cache.get(user.id).allow.has(PermissionsBitField.Flags.ViewChannel)
    );

    if (existing) {
      const alreadyEmbed = new EmbedBuilder()
        .setTitle('Ticket Already Open')
        .setDescription('You already have an active ticket. Please close it before opening another.')
        .setColor('Red');

      const redirectRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Go to Ticket')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guild.id}/${existing.id}`)
      );

      return interaction.reply({ embeds: [alreadyEmbed], components: [redirectRow], flags: 64 });
    }

    // Create new ticket
    const username = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    const ticketName = `${type}-${username}`;

    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Close Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket Opened')
      .setDescription(`Hello <@${user.id}>, thank you for selecting **${type}** service.\nPlease describe your request below.`)
      .setColor('#5865F2')
      .setTimestamp();

    await channel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [closeRow] });

    const createdEmbed = new EmbedBuilder()
      .setTitle('✅ Ticket Created')
      .setDescription('Your ticket has been successfully created.')
      .setColor('Green');

    const jumpButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Go to Ticket')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
    );

    return interaction.reply({ embeds: [createdEmbed], components: [jumpButton], flags: 64 });
  }

  // Close Ticket Handler
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', flags: 64 });
    setTimeout(() => {
      interaction.channel.delete().catch(console.error);
    }, 5000);
  }
});

client.login(process.env.TOKEN);

// Web server for Cyclic.sh to stay alive
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Rosevia Bot is running on Cyclic'));
app.listen(3000, () => console.log('🌐 Express server ready on port 3000'));
