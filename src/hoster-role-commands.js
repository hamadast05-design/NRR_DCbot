const { PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('./access');

const HOSTER_MANAGER_ROLE_ID = '1213496602501582888';

function parseHex(value) {
  const match = String(value || '').trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? Number.parseInt(match[1], 16) : null;
}

async function handlePrefixRoleCommands(message) {
  if (!message.guild || message.author.bot || message.webhookId) return false;
  const input = message.content.trim();

  if (/^!rname(?:\s|$)/i.test(input)) {
    const name = input.replace(/^!rname\s*/i, '').trim();
    if (!name) {
      await message.reply('Usage: `!Rname New Hoster Manager Name`').catch(() => {});
      return true;
    }
    if (name.length > 100) {
      await message.reply('❌ Discord role names must be 100 characters or fewer.').catch(() => {});
      return true;
    }
    if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageRoles)) {
      await message.reply('❌ You need Manage Roles permission to rename the Hoster Manager role.').catch(() => {});
      return true;
    }

    const role = await message.guild.roles.fetch(HOSTER_MANAGER_ROLE_ID).catch(() => null);
    if (!role) {
      await message.reply('❌ I could not find the Hoster Manager role in this server.').catch(() => {});
      return true;
    }
    const botMember = message.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.roles.highest || botMember.roles.highest.position <= role.position || role.managed) {
      await message.reply('❌ I cannot edit that role. Check my Manage Roles permission and role hierarchy.').catch(() => {});
      return true;
    }
    try {
      const previousName = role.name;
      await role.setName(name, 'Hoster Manager role renamed by ' + message.author.tag);
      await message.reply('✅ Renamed the Hoster Manager role from **' + previousName + '** to **' + role.name + '**.').catch(() => {});
    } catch (error) {
      console.error('!Rname failed:', error);
      await message.reply('❌ I could not rename the role. Check Discord permissions and server role restrictions.').catch(() => {});
    }
    return true;
  }

  if (/^!gcolor(?:\s|$)/i.test(input)) {
    const rawColors = input.replace(/^!gcolor\s*/i, '').trim();
    const parts = rawColors.split(',').map(part => part.trim());
    if (parts.length !== 2) {
      await message.reply('Usage: `!Gcolor #00EAFF, #FFFFFF` (provide exactly two 6-digit hex colors).').catch(() => {});
      return true;
    }
    const primaryColor = parseHex(parts[0]);
    const secondaryColor = parseHex(parts[1]);
    if (primaryColor === null || secondaryColor === null) {
      await message.reply('❌ Invalid colors. Use two 6-digit hex values, for example `#00EAFF, #FFFFFF`.').catch(() => {});
      return true;
    }
    if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageRoles)) {
      await message.reply('❌ You need Manage Roles permission to change the Hoster Manager role colors.').catch(() => {});
      return true;
    }

    const role = await message.guild.roles.fetch(HOSTER_MANAGER_ROLE_ID).catch(() => null);
    if (!role) {
      await message.reply('❌ I could not find the Hoster Manager role in this server.').catch(() => {});
      return true;
    }
    const botMember = message.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.roles.highest || botMember.roles.highest.position <= role.position || role.managed) {
      await message.reply('❌ I cannot edit that role. Check my Manage Roles permission and role hierarchy.').catch(() => {});
      return true;
    }
    if (typeof role.setColors !== 'function') {
      await message.reply('❌ This Discord.js version does not support gradient role colors.').catch(() => {});
      return true;
    }
    try {
      await role.setColors(
        { primaryColor, secondaryColor },
        'Hoster Manager gradient colors changed by ' + message.author.tag
      );
      await message.reply('✅ Updated the Hoster Manager role gradient to **#' + primaryColor.toString(16).padStart(6, '0').toUpperCase() + '** → **#' + secondaryColor.toString(16).padStart(6, '0').toUpperCase() + '**.').catch(() => {});
    } catch (error) {
      console.error('!Gcolor failed:', error);
      await message.reply('❌ I could not change the gradient. Discord may require gradient-role features to be available for this server, or the bot may lack permission.').catch(() => {});
    }
    return true;
  }

  return false;
}

module.exports = { handlePrefixRoleCommands, HOSTER_MANAGER_ROLE_ID };
