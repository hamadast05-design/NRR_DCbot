const crypto = require('crypto');
const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');

const TARGET_USER_ID = '1427371780087222463';
const TARGET_ROLE_ID = '1213496602501582888';

function hashCode(value) {
  return crypto.createHash('sha256').update(String(value).trim().toUpperCase()).digest('hex');
}

async function redeemRole(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({ content: '❌ This code can only be redeemed inside the NRR server.', ephemeral: true });
  }
  if (interaction.user.id !== TARGET_USER_ID) {
    return interaction.reply({ content: '❌ This redemption code is not assigned to your account.', ephemeral: true });
  }

  const configuredCode = process.env.ROLE_REDEMPTION_CODE;
  if (!configuredCode) {
    return interaction.reply({ content: '❌ Role redemption is not configured yet. Please contact an administrator.', ephemeral: true });
  }

  const submitted = interaction.options.getString('code', true);
  const expectedHash = hashCode(configuredCode);
  const submittedHash = hashCode(submitted);
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(submittedHash, 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    return interaction.reply({ content: '❌ That redemption code is invalid.', ephemeral: true });
  }

  const role = await interaction.guild.roles.fetch(TARGET_ROLE_ID).catch(() => null);
  if (!role) return interaction.reply({ content: '❌ The configured role could not be found in this server.', ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ I could not find your server membership.', ephemeral: true });
  if (member.roles.cache.has(role.id)) {
    return interaction.reply({ content: 'ℹ️ You already have that role. The code was not consumed.', ephemeral: true });
  }

  const botMember = interaction.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.roles.highest || botMember.roles.highest.position <= role.position || role.managed) {
    return interaction.reply({ content: '❌ I cannot assign that role. Check my Manage Roles permission and role hierarchy.', ephemeral: true });
  }

  const claimed = await db.query(
    'INSERT INTO role_redemption_codes (code_hash, guild_id, user_id, role_id) VALUES ($1, $2, $3, $4) ON CONFLICT (code_hash) DO NOTHING RETURNING code_hash',
    [expectedHash, interaction.guildId, interaction.user.id, role.id]
  );
  if (!claimed.rowCount) {
    return interaction.reply({ content: '❌ This code has already been used.', ephemeral: true });
  }

  try {
    await member.roles.add(role, 'One-time role redemption code');
    return interaction.reply({ content: '✅ Code accepted! The role has been added to your account. This code can no longer be used.', ephemeral: true });
  } catch (error) {
    await db.query('DELETE FROM role_redemption_codes WHERE code_hash = $1 AND user_id = $2', [expectedHash, interaction.user.id]).catch(() => {});
    console.error('Role redemption assignment failed:', error);
    return interaction.reply({ content: '❌ I could not assign the role. The code has been released so you can retry after an administrator fixes the permissions.', ephemeral: true });
  }
}

async function moveRoleUp(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({ content: '❌ This command only works inside a server.', ephemeral: true });
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: '❌ You need Manage Roles permission to use this command.', ephemeral: true });
  }

  const steps = interaction.options.getInteger('positions', true);
  const role = await interaction.guild.roles.fetch(TARGET_ROLE_ID).catch(() => null);
  if (!role) return interaction.reply({ content: '❌ The configured role could not be found in this server.', ephemeral: true });
  if (role.managed) return interaction.reply({ content: '❌ Discord-managed roles cannot be repositioned.', ephemeral: true });

  const botMember = interaction.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: '❌ I need Manage Roles permission to reposition this role.', ephemeral: true });
  }
  const botHighest = botMember.roles.highest;
  if (!botHighest || botHighest.position <= role.position) {
    return interaction.reply({ content: '❌ My highest role must be above the target role before I can move it.', ephemeral: true });
  }

  const requestedPosition = role.position + steps;
  const maximumPosition = botHighest.position - 1;
  const newPosition = Math.min(requestedPosition, maximumPosition);
  if (newPosition <= role.position) {
    return interaction.reply({ content: '❌ I cannot move this role any higher without crossing my own highest role.', ephemeral: true });
  }

  try {
    await role.setPosition(newPosition, { reason: 'Role position adjusted by an authorized server manager' });
    const refreshed = await interaction.guild.roles.fetch(role.id);
    const movedBy = refreshed.position - role.position;
    return interaction.reply({
      content: '✅ Moved <@&' + role.id + '> up by **' + movedBy + '** position' + (movedBy === 1 ? '' : 's') + (movedBy < steps ? ' (maximum allowed by my role hierarchy).' : '.') ,
      allowedMentions: { parse: [] },
      ephemeral: true
    });
  } catch (error) {
    console.error('Role position update failed:', error);
    return interaction.reply({ content: '❌ Discord rejected the role move. Check the role hierarchy and try a smaller number of positions.', ephemeral: true });
  }
}

module.exports = { redeemRole, moveRoleUp };
