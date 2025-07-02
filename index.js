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

// Initialize Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// IDs and Constants
const CATEGORY_ID = '1389516515971170395';
const ADMIN_ROLE_ID = '1389516588205735996';
const VERIFIED_ROLE_ID = '1389515783079596152';
const CASH_EMOJI = { id: '1389922470168887306', name: 'Cashapp' };
const VERIFY_BANNER = 'https://cdn.discordapp.com/attachments/1389920703259873290/1389936835509092362/1e4f6407d33a14f96346be21ffb8b519.jpg';

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
        'Welcome to the Rosevia Storefront!\n\n**Choose a service** to get started with your purchase. Our team will assist you through the ticket.\n\n**TOS Highlights:**\n' +
        '• No refunds after delivery\n' +
        '• 1 free revision\n' +
        '• Chargebacks = permanent ban\n' +
        '• Closing ticket = service accepted'
      )
      .setImage('https://cdn.discordapp.com/attachments/1389920703259873290/1389921008840081408/668fbc560f8ed6375b9f5f92aa59d3cd.gif')
      .setColor('#2B2D31');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_type')
      .setPlaceholder('🛒 Choose a service')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Embed').setValue('embed').setDescription('To purchase a custom embed').setEmoji(CASH_EMOJI),
        new StringSelectMenuOptionBuilder().setLabel('Logo').setValue('logo').setDescription('To purchase a logo').setEmoji(CASH_EMOJI),
        new StringSelectMenuOptionBuilder().setLabel('Server Setup').setValue('setup').setDescription('To purchase a full server setup').setEmoji(CASH_EMOJI)
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await msg.channel.send({ embeds: [embed], components: [row] });
  }

  // Verification Panel Command
  if (msg.content === '!verify' && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Verify to Access Server')
      .setDescription(
        'To access all channels and start your journey, please click the **Verify Me** button below.\n\n' +
        '**This ensures you are not a bot and agree to our rules.**\n' +
        '• No spam or self-promo\n' +
        '• Respect all members\n' +
        '• Follow community guidelines'
      )
      .setImage(VERIFY_BANNER)
      .setColor('#00cc99');

    const verifyBtn = new ButtonBuilder()
      .setCustomId('verify_user')
      .setLabel('✅ Verify Me')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(verifyBtn);
    await msg.channel.send({ embeds: [embed], components: [row] });
  }
});

// Interaction Handler
client.on('interactionCreate', async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
    const type = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;

    const existing = guild.channels.cache.find(
      c =>
        c.parentId === CATEGORY_ID &&
        c.permissionOverwrites.cache.has(user.id) &&
        c.permissionOverwrites.cache.get(user.id).allow.has(PermissionsBitField.Flags.ViewChannel)
    );

    if (existing) {
      const alreadyEmbed = new EmbedBuilder()
        .setTitle('Ticket Already Open')
        .setDescription('You already have an open ticket. Please close it before opening a new one.')
        .setColor('Red');

      const redirect = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Go to Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${existing.id}`)
      );

      return interaction.reply({ embeds: [alreadyEmbed], components: [redirect], flags: 64 });
    }

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

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
    );

    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket Opened')
      .setDescription(`Hello <@${user.id}>, thank you for selecting **${type}** service.\nPlease describe your request below.`)
      .setColor('#5865F2')
      .setTimestamp();

    await channel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [closeBtn] });

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Ticket Created')
      .setDescription('Your ticket has been created. Our team will assist you shortly.')
      .setColor('Green');

    const jump = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Go to Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
    );

    return interaction.reply({ embeds: [confirmEmbed], components: [jump], flags: 64 });
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', flags: 64 });
    setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
  }

  if (interaction.isButton() && interaction.customId === 'verify_user') {
    if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({ content: '✅ You are already verified.', ephemeral: true });
    }

    await interaction.member.roles.add(VERIFIED_ROLE_ID);
    return interaction.reply({ content: '🎉 You have been verified and now have full access to the server!', ephemeral: true });
  }
});

// Web server for Cyclic hosting
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('✅ Rosevia Bot is running on Cyclic'));
app.listen(3000, () => console.log('🌐 Express server running on port 3000'));

// Login
client.login(process.env.TOKEN);
