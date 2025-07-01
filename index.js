const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const TICKET_CATEGORY_ID = '1389516515971170395'; // ✅ your ticket category ID
const ADMIN_ROLE_ID = '1389516588205735996';      // ✅ your admin role ID

const RAZORPAY_LINKS = {
  embed: 'https://rzp.io/l/embed',
  logo: 'https://rzp.io/l/logo',
  setup: 'https://rzp.io/l/setup',
  roles: 'https://rzp.io/l/roles',
  bot: 'https://rzp.io/l/botsetup',
};

// ✅ Bot Ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ✅ Send embed with dropdown menu
client.on('messageCreate', async (message) => {
  if (message.content === '!send-tickets' && message.member.permissions.has('Administrator')) {
    const embed = new EmbedBuilder()
      .setTitle('🎟️ Open a Ticket')
      .setDescription('Select the service you want from the dropdown below.')
      .setColor('#FF66B2');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_service')
      .setPlaceholder('📂 Choose a Service')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎨 Purchase Embed').setValue('embed'),
        new StringSelectMenuOptionBuilder().setLabel('🖼️ Purchase Logo').setValue('logo'),
        new StringSelectMenuOptionBuilder().setLabel('🛠️ Server Setup').setValue('setup'),
        new StringSelectMenuOptionBuilder().setLabel('🎭 Role Setup').setValue('roles'),
        new StringSelectMenuOptionBuilder().setLabel('🤖 Bot Setup').setValue('bot'),
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ✅ Handle dropdown selection
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'select_service') return;

  const userId = interaction.user.id;
  const guild = interaction.guild;
  const product = interaction.values[0];

  const channelName = `ticket-${interaction.user.username}`;
  const existing = guild.channels.cache.find(c => c.name === channelName);
  if (existing) {
    return interaction.reply({
      content: '🛑 You already have an open ticket.',
      ephemeral: true
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    topic: `<@${userId}>`, // Store user mention for later
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
      { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ],
  });

  const payRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('💳 Pay Now')
      .setStyle(ButtonStyle.Link)
      .setURL(RAZORPAY_LINKS[product])
  );

  await ticketChannel.send({
    content: `👋 Hi <@${userId}>! Thanks for choosing **${product}**.\nPlease complete your payment using the button below.`,
    components: [payRow]
  });

  await interaction.reply({
    content: `✅ Ticket created: ${ticketChannel}`,
    ephemeral: true
  });

  // Auto-close after 12 hours
  setTimeout(async () => {
    await ticketChannel.send(`🔒 This ticket has been automatically closed after 12 hours.`);
    await ticketChannel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: false });
  }, 12 * 60 * 60 * 1000);
});

// ✅ Unlock command (to allow user to send messages)
client.on('messageCreate', async (message) => {
  if (message.content === '!unlock' && message.member.roles.cache.has(ADMIN_ROLE_ID)) {
    const topic = message.channel.topic;
    const userId = topic?.match(/<@(\d+)>/)?.[1];

    if (!userId) {
      return message.reply('❌ No user found in this channel topic.');
    }

    await message.channel.permissionOverwrites.edit(userId, {
      SendMessages: true
    });

    await message.channel.send(`✅ <@${userId}>, your access has been unlocked. You can now chat.`);
  }
});

// 🔧 Error handler
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled Rejection:', error);
});

client.login(process.env.TOKEN);
