const { randomUUID } = require('node:crypto');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const db = require('./db');
const crust = require('./crust');
const { SUPERUSER_ID } = require('./access');

const pendingTests = new Map();
const CONFIRMATION_TTL_MS = 2 * 60 * 1000;
const TEST_REASON = 'Owner-approved Crust Staff Points integration test';

const command = new SlashCommandBuilder()
  .setName('crust_test_award')
  .setDescription('Run a guarded 1-point Crust API integration test (owner only).')
  .addUserOption(option => option
    .setName('recipient')
    .setDescription('The staff member receiving the test point.')
    .setRequired(true))
  .addBooleanOption(option => option
    .setName('hr_approved')
    .setDescription('Confirm the recipient has explicitly approved this test.')
    .setRequired(true));

function isOwner(interaction) {
  return interaction.user?.id === SUPERUSER_ID;
}

function confirmationRow(testId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('crusttest:confirm:' + testId)
      .setLabel('Confirm 1-point test')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('crusttest:cancel:' + testId)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function handleCommand(interaction) {
  if (!isOwner(interaction)) {
    return interaction.reply({ content: '❌ This command is restricted to the bot owner.', ephemeral: true });
  }
  if (!interaction.inGuild()) {
    return interaction.reply({ content: '❌ Run this command inside the NRR server.', ephemeral: true });
  }

  const recipient = interaction.options.getUser('recipient', true);
  const hrApproved = interaction.options.getBoolean('hr_approved', true);
  if (!hrApproved) {
    return interaction.reply({ content: '❌ The recipient’s explicit approval is required. No test was started.', ephemeral: true });
  }
  if (recipient.bot) {
    return interaction.reply({ content: '❌ A bot account cannot be used as the test recipient.', ephemeral: true });
  }
  if (!process.env.STAFF_POINTS_API_SECRET) {
    return interaction.reply({ content: '❌ Crust testing is unavailable: the API secret is not configured.', ephemeral: true });
  }

  const testId = randomUUID();
  pendingTests.set(testId, {
    actorId: interaction.user.id,
    recipientId: recipient.id,
    recipientTag: recipient.tag || recipient.username,
    guildId: interaction.guildId,
    createdAt: Date.now(),
  });
  const expiry = setTimeout(() => pendingTests.delete(testId), CONFIRMATION_TTL_MS);
  expiry.unref?.();

  const embed = new EmbedBuilder()
    .setColor(0xe0a526)
    .setTitle('Confirm Crust integration test')
    .setDescription(
      'This will send a **real Staff Points award** through Crust.\n\n' +
      '**Recipient:** <@' + recipient.id + '>\n' +
      '**Amount:** 1 Staff Point\n' +
      '**Reason:** ' + TEST_REASON + '\n\n' +
      'You confirmed that the recipient explicitly approved this test. Confirm below to send the award.'
    )
    .setFooter({ text: 'This confirmation expires in 2 minutes. The test cannot be undone here.' });

  return interaction.reply({
    embeds: [embed],
    components: [confirmationRow(testId)],
    ephemeral: true,
    allowedMentions: { parse: [] },
  });
}

async function handleButton(interaction) {
  const [, action, testId] = interaction.customId.split(':');
  const pending = pendingTests.get(testId);

  if (!pending) {
    return interaction.reply({ content: '⌛ This test confirmation has expired or was already used. Run the command again.', ephemeral: true });
  }
  if (interaction.user.id !== pending.actorId || !isOwner(interaction)) {
    return interaction.reply({ content: '❌ Only the owner who started this test can confirm or cancel it.', ephemeral: true });
  }

  pendingTests.delete(testId);

  if (action === 'cancel') {
    return interaction.update({
      content: 'Test cancelled. No Staff Points were awarded.',
      embeds: [],
      components: [],
    });
  }
  if (action !== 'confirm') {
    return interaction.reply({ content: '❌ Invalid test action.', ephemeral: true });
  }

  await interaction.update({
    content: '⏳ Sending the 1-point Crust test award…',
    embeds: [],
    components: [],
  });

  const referenceId = 'crust-manual-test-' + testId;
  try {
    await db.query(
      `INSERT INTO crust_staff_point_test_audits
        (test_id, actor_id, recipient_id, amount, reference_id, status)
       VALUES ($1, $2, $3, 1, $4, 'pending')`,
      [testId, pending.actorId, pending.recipientId, referenceId]
    );

    const result = await crust.awardStaffPoints({
      discordUserId: pending.recipientId,
      amount: 1,
      reason: TEST_REASON,
      referenceId,
    });
    const statusRow = await crust.getAwardStatus(referenceId);
    const status = statusRow?.status || result.status || 'unknown';
    await db.query(
      `UPDATE crust_staff_point_test_audits
       SET status = $2, result = $3::jsonb, updated_at = NOW()
       WHERE test_id = $1`,
      [testId, status, JSON.stringify({ clientResult: result, awardStatus: statusRow })]
    );

    const success = status === 'awarded';
    const embed = new EmbedBuilder()
      .setColor(success ? 0x2ecc71 : 0xe0a526)
      .setTitle(success ? 'Crust test award successful' : 'Crust test result')
      .setDescription(
        (success ? 'Crust confirmed the award.' : 'The request did not reach a confirmed awarded state.') +
        '\n\n**Recipient:** <@' + pending.recipientId + '>' +
        '\n**Amount:** 1 Staff Point' +
        '\n**Status:** `' + status + '`' +
        '\n**Reference:** `' + referenceId + '`'
      )
      .setFooter({ text: 'The attempt and result have been recorded in the database audit log.' });
    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('[Crust Test] Award attempt failed:', {
      testId,
      referenceId,
      message: error?.message || String(error),
    });
    await db.query(
      `UPDATE crust_staff_point_test_audits
       SET status = 'failed', result = $2::jsonb, updated_at = NOW()
       WHERE test_id = $1`,
      [testId, JSON.stringify({ error: error?.message || String(error) })]
    ).catch(auditError => {
      console.error('[Crust Test] Could not update audit record:', auditError?.message || auditError);
    });
    return interaction.editReply({
      content: '❌ The Crust test failed. Check the bot logs and audit record; do not repeat the award until its status is verified. Reference: `' + referenceId + '`',
      embeds: [],
      allowedMentions: { parse: [] },
    });
  }
}

async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'crust_test_award') {
    return handleCommand(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('crusttest:')) {
    return handleButton(interaction);
  }
  return false;
}

module.exports = { command, handleInteraction };
