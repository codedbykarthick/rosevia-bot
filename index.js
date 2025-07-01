require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Constants
const TICKET_CATEGORY_ID = '1389516515971170395'; // replace with your category ID
const ADMIN_ROLE_ID = '1389516588205735996';      // replace with your admin role ID
const RAZORPAY_LINKS = {
  embed: 'https://rzp.io/l/embed',
  logo: 'https://rzp.io/l/logo',
  setup: 'https://rzp.io/l/setup',
  roles: 'https://rzp.io/l/roles',
  bot: 'https://rzp.io/l/botsetup',
};

// Store active ticket mapping
const activeTickets = new Map();

// Bot ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Handle dropdown menu interaction
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const product = interaction.values[0]; // selected item
  const userId = interaction.user.id;
  const guild = interaction.guild;

  const channelName = `ticket-${interaction.user.username}`;
  if (guild.channels.cache.find(c => c.name === channelName)) {
    return interaction.reply({ content: '🛑 You already have an open ticket.', ephemeral: true });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
      { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  // Save ticket info for webhook unlock
  activeTickets.set(userId, channel.id);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('paid')
      .setPlaceholder('💳 Pay Now')
      .addOptions([
        {
          label: 'Click here to pay',
          value: 'pay',
          description: 'Make payment via Razorpay',
          emoji: '💳',
          default: true,
        }
      ])
  );

  await channel.send({
    content: `👋 Hello <@${userId}>! You selected **${product}**.\n💳 Please complete your payment here: ${RAZORPAY_LINKS[product]}\nOnce verified, your channel will be unlocked.`,
  });

  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
});

// Command to send the dropdown menu
client.on('messageCreate', async (msg) => {
  if (msg.content === '!send-tickets' && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('product_select')
      .setPlaceholder('📦 Choose a product')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎨 Embed').setValue('embed'),
        new StringSelectMenuOptionBuilder().setLabel('🖼️ Logo').setValue('logo'),
        new StringSelectMenuOptionBuilder().setLabel('🛠️ Setup').setValue('setup'),
        new StringSelectMenuOptionBuilder().setLabel('🎭 Roles').setValue('roles'),
        new StringSelectMenuOptionBuilder().setLabel('🤖 Bot Setup').setValue('bot')
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await msg.channel.send({ content: '📩 Select a service to open a ticket:', components: [row] });
  }
});

client.login(process.env.TOKEN);


// ---------- EXPRESS SERVER FOR RAILWAY + WEBHOOK ----------
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Rosevia Bot is live.');
});

// Unlock endpoint (triggered from Make.com)
app.post('/unlock', async (req, res) => {
  const { discord_user_id } = req.body;
  if (!discord_user_id || !activeTickets.has(discord_user_id)) {
    return res.status(400).send('Invalid user ID or ticket not found.');
  }

  const channelId = activeTickets.get(discord_user_id);
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get(channelId);

  if (!channel) return res.status(404).send('Channel not found.');

  await channel.permissionOverwrites.edit(discord_user_id, {
    SendMessages: true,
    ViewChannel: true
  });

  await channel.send(`✅ Payment confirmed. <@${discord_user_id}> you can now chat here. Thank you!`);
  activeTickets.delete(discord_user_id);
  res.send('Channel unlocked successfully.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Express server is running on port ${PORT}`);
});
