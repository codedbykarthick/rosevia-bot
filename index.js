// Required dependencies
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder
} = require('discord.js');
require('dotenv').config();

// Discord Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Constants
const TICKET_CATEGORY_ID = '1389516515971170395';
const ADMIN_ROLE_ID = '1389516588205735996';
const RAZORPAY_LINKS = {
  embed: 'https://rzp.io/l/embed',
  logo: 'https://rzp.io/l/logo',
  setup: 'https://rzp.io/l/setup',
  roles: 'https://rzp.io/l/roles',
  bot: 'https://rzp.io/l/botsetup',
};

// Active ticket tracker
const activeTickets = new Map();

// Bot Ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Dropdown Handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const product = interaction.values[0];
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const username = interaction.user.username;

  const channelName = `ticket-${username}`;
  if (guild.channels.cache.find(c => c.name === channelName)) {
    return interaction.reply({ content: '🛑 You already have an open ticket.', ephemeral: true });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
      { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  activeTickets.set(userId, ticketChannel.id);

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ New Ticket: ${product.toUpperCase()}`)
    .setDescription(`Hello <@${userId}> 👋\n\nYou selected **${product}**.\n\n💳 Please complete payment using the link below:`)
    .addFields({ name: '🔗 Payment Link', value: `[Click to Pay](${RAZORPAY_LINKS[product]})` })
    .setColor('#00BFFF')
    .setFooter({ text: 'Rosevia Services • Ticket System', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  await ticketChannel.send({ embeds: [embed] });
  await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });

  // Auto-close after 12 hrs
  setTimeout(async () => {
    if (ticketChannel) {
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('This ticket has been closed due to **12 hours of inactivity**.\nIf you still need help, please create a new ticket.')
        .setColor('#FF4500')
        .setTimestamp();

      await ticketChannel.send({ embeds: [closeEmbed] });
      await ticketChannel.permissionOverwrites.edit(userId, { ViewChannel: false });
    }
  }, 12 * 60 * 60 * 1000);
});

// Send Dropdown
client.on('messageCreate', async (msg) => {
  if (msg.content === '!send-tickets' && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('product_select')
      .setPlaceholder('📦 Select a service')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎨 Embed').setValue('embed'),
        new StringSelectMenuOptionBuilder().setLabel('🖼️ Logo').setValue('logo'),
        new StringSelectMenuOptionBuilder().setLabel('🛠️ Setup').setValue('setup'),
        new StringSelectMenuOptionBuilder().setLabel('🎭 Roles').setValue('roles'),
        new StringSelectMenuOptionBuilder().setLabel('🤖 Bot Setup').setValue('bot')
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await msg.channel.send({ content: '📩 Choose a service to open a ticket:', components: [row] });
  }
});

// Express Server
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('🟢 Rosevia Bot is running!');
});

// Unlock via Make.com webhook
app.post('/unlock', async (req, res) => {
  const { userId } = req.body;

  if (!userId || !activeTickets.has(userId)) {
    return res.status(400).send('Invalid user ID or no ticket found.');
  }

  try {
    const guild = client.guilds.cache.first();
    const channelId = activeTickets.get(userId);
    const channel = guild.channels.cache.get(channelId);

    if (!channel) return res.status(404).send('Ticket channel not found.');

    await channel.permissionOverwrites.edit(userId, {
      SendMessages: true,
      ViewChannel: true
    });

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Payment Confirmed')
      .setDescription(`Welcome <@${userId}>!\n\nYour payment has been successfully verified.\nYou may now chat here with our team.`)
      .setColor('#32CD32')
      .setTimestamp();

    await channel.send({ embeds: [confirmEmbed] });
    activeTickets.delete(userId);
    return res.status(200).send('✅ Channel unlocked.');
  } catch (err) {
    console.error('❌ Unlock Error:', err);
    res.status(500).send('Server error unlocking channel.');
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Express running on port ${PORT}`);
});

client.login(process.env.TOKEN);
