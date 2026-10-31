const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const db = require('./db');

const REVIEW_CHANNEL_ID = '1566109303318913074';
const QOTD_ROLE_ID = '1106014506041217064';
const PREFIX = 'qotd:';
const MANAGE = PermissionFlagsBits.ManageGuild;

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_qotd_settings (
      guild_id TEXT PRIMARY KEY, channel_id TEXT, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS nrr_qotd_submissions (
      id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL, submitter_id TEXT NOT NULL,
      question TEXT NOT NULL, answers JSONB NOT NULL, emojis JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending', review_channel_id TEXT, review_message_id TEXT,
      published_channel_id TEXT, published_message_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_by TEXT, reviewed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_nrr_qotd_pending ON nrr_qotd_submissions(status,created_at);
  `);
}
function isManager(i) {
  return Boolean(i.memberPermissions?.has(MANAGE));
}
function reviewEmbed(row, status = 'pending') {
  const answers = (row.answers || []).map((a, i) => {
    const emoji = row.emojis?.[i] || '•';
    return '**' + (i + 1) + '. ' + emoji + ' ' + a + '**';
  }).join('\n');
  return new EmbedBuilder().setColor(0x3c3c3d)
    .setTitle('QOTD Submission • ' + status.toUpperCase())
    .setDescription('**Question**\n' + row.question + '\n\n**Answer options**\n' + answers)
    .addFields({ name: 'SUBMITTED BY', value: '<@' + row.submitter_id + '>', inline: true },
      { name: 'SUBMISSION ID', value: String(row.id), inline: true })
    .setFooter({ text: 'NRR • QOTD Review' }).setTimestamp(new Date(row.created_at));
}
function reviewButtons(id, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PREFIX + 'approve:' + id).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(disabled),
      new ButtonBuilder().setCustomId(PREFIX + 'deny:' + id).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌').setDisabled(disabled),
      new ButtonBuilder().setCustomId(PREFIX + 'edit:' + id).setLabel('Edit').setStyle(ButtonStyle.Secondary).setEmoji('✏️').setDisabled(disabled),
      new ButtonBuilder().setCustomId(PREFIX + 'final:' + id).setLabel('Edit Final Message').setStyle(ButtonStyle.Primary).setEmoji('📝').setDisabled(disabled)
    )
  ];
}
function submissionModal(id = 'new', row = null) {
  const modal = new ModalBuilder().setCustomId(PREFIX + 'submit:' + id).setTitle(row ? 'Edit QOTD Submission' : 'Submit a QOTD');
  const answers = (row?.answers || []).join('\n');
  const fields = [
    ['question', 'Question', TextInputStyle.Paragraph, true, 300, row?.question || ''],
    ['answers', 'Answer options (one per line, 2–3)', TextInputStyle.Paragraph, true, 350, answers],
    ['emoji1', 'Emoji for answer 1', TextInputStyle.Short, true, 32, row?.emojis?.[0] || ''],
    ['emoji2', 'Emoji for answer 2', TextInputStyle.Short, true, 32, row?.emojis?.[1] || ''],
    ['emoji3', 'Emoji for answer 3 (if answer 3 is used)', TextInputStyle.Short, false, 32, row?.emojis?.[2] || '']
  ];
  for (const [fieldId, label, style, required, max, value] of fields) {
    const input = new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
    if (value) input.setValue(String(value).slice(0,max));
    modal.addComponents({ type: 1, components: [input] });
  }
  return modal;
}
function oneEmoji(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (/^<a?:[A-Za-z0-9_]{2,32}:\d{17,22}>$/.test(v)) return true;
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(v)].length === 1;
  }
  return [...v].length <= 4;
}
function reactionValue(value) {
  const custom = String(value || '').trim().match(/^<a?:[A-Za-z0-9_]{2,32}:(\d{17,22})>$/);
  return custom ? custom[1] : value;
}
function finalModal(row) {
  const modal = new ModalBuilder().setCustomId(PREFIX + 'finalsubmit:' + row.id).setTitle('Edit Final QOTD Message');
  modal.addComponents({ type: 1, components: [new TextInputBuilder().setCustomId('question').setLabel('Final question text').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setValue(row.question)] });
  modal.addComponents({ type: 1, components: [new TextInputBuilder().setCustomId('answers').setLabel('Answers, one per line (emoji :- answer)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setValue((row.answers || []).map((a,i)=>(row.emojis?.[i] || '▫️') + ' :- ' + a).join('\n'))] });
  return modal;
}
async function countMessages(guildId, userId) {
  const r = await db.query(`SELECT COUNT(*)::int AS n FROM nrr_message_activity
    WHERE guild_id=$1 AND user_id=$2 AND created_at >= NOW() - INTERVAL '24 hours'`, [guildId,userId]);
  return Number(r.rows[0]?.n || 0);
}
async function sendPanel(message) {
  if (!message.guild) return;
  if (!message.member?.permissions?.has(MANAGE)) return message.reply('❌ You need Manage Server permission to post the QOTD submission panel.');
  const embed = new EmbedBuilder().setColor(0x3c3c3d).setTitle('QOTD Submissions')
    .setDescription('Have a question worth sharing? Submit it for the community Question of the Day.\n\nYour submission will be reviewed by the QOTD managers before it is published.')
    .setFooter({ text: 'NRR • Community QOTD' });
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(PREFIX + 'open').setLabel('Submit a Question').setEmoji('📝').setStyle(ButtonStyle.Primary));
  await message.channel.send({ embeds:[embed], components:[row] });
  await message.reply('✅ QOTD submission panel posted.');
}
async function setChannel(message, channelId) {
  if (!message.member?.permissions?.has(MANAGE)) return message.reply('❌ You need Manage Server permission to set the QOTD channel.');
  if (!/^\d{17,22}$/.test(channelId || '')) return message.reply('Usage: !set_qotd_channel [channel_id]');
  const channel = await message.guild.channels.fetch(channelId).catch(()=>null);
  if (!channel?.isTextBased()) return message.reply('❌ I could not find a text channel with that ID.');
  await db.query(`INSERT INTO nrr_qotd_settings(guild_id,channel_id,updated_by) VALUES($1,$2,$3)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id=EXCLUDED.channel_id,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
    [message.guild.id,channel.id,message.author.id]);
  return message.reply('✅ QOTD destination set to <#' + channel.id + '>.');
}
async function onButton(i) {
  const [, action, id] = i.customId.split(':');
  if (action === 'open') {
    const count = await countMessages(i.guildId, i.user.id);
    if (count < 20) return i.reply({ content:'Sorry! In order to submit your Qotd, you must have sent **20 messages** today. Currently you have **' + count + '** messages sent today.', ephemeral:true });
    return i.showModal(submissionModal());
  }
  if (!isManager(i)) return i.reply({ content:'❌ You do not have permission to review QOTD submissions.', ephemeral:true });
  const r = await db.query('SELECT * FROM nrr_qotd_submissions WHERE id=$1 AND guild_id=$2', [id,i.guildId]);
  const row = r.rows[0];
  if (!row) return i.reply({ content:'❌ Submission not found.',ephemeral:true });
  if (action === 'edit') return i.showModal(submissionModal(id,row));
  if (action === 'final') return i.showModal(finalModal(row));
  if (action === 'deny') {
    const u = await db.query(`UPDATE nrr_qotd_submissions SET status='denied',reviewed_by=$2,reviewed_at=NOW()
      WHERE id=$1 AND status='pending' RETURNING id`,[id,i.user.id]);
    if (!u.rowCount) return i.reply({content:'This submission has already been reviewed.',ephemeral:true});
    await i.update({embeds:[reviewEmbed(row,'denied')],components:reviewButtons(id,true)});
    const submitter = await i.client.users.fetch(row.submitter_id).catch(()=>null); await submitter?.send({content:'Your QOTD submission was not approved by the managers.'}).catch(()=>{});
    return;
  }
  if (action === 'approve') {
    const settings = await db.query('SELECT channel_id FROM nrr_qotd_settings WHERE guild_id=$1',[i.guildId]);
    const channelId = settings.rows[0]?.channel_id;
    if (!channelId) return i.reply({content:'❌ No QOTD destination is configured. An admin must use !set_qotd_channel [channel_id].',ephemeral:true});
    const channel = await i.guild.channels.fetch(channelId).catch(()=>null);
    if (!channel?.isTextBased()) return i.reply({content:'❌ The configured QOTD channel is unavailable.',ephemeral:true});
    const claimed = await db.query(`UPDATE nrr_qotd_submissions SET status='approved',reviewed_by=$2,reviewed_at=NOW()
      WHERE id=$1 AND status='pending' RETURNING id`,[id,i.user.id]);
    if (!claimed.rowCount) return i.reply({content:'This submission has already been reviewed.',ephemeral:true});
    const lines = row.answers.map((a,n) => '## ' + (row.emojis?.[n] || ['1️⃣','2️⃣','3️⃣'][n]) + ' :- ' + a).join('\n');
    const sent = await channel.send({content:'# ' + row.question + '\n<@&' + QOTD_ROLE_ID + '>\n\n' + lines,allowedMentions:{roles:[QOTD_ROLE_ID]}});
    for (let n=0;n<row.answers.length;n++) {
      const emoji = row.emojis?.[n] || ['1️⃣','2️⃣','3️⃣'][n];
      await sent.react(reactionValue(emoji)).catch(error=>console.error('QOTD reaction failed:',emoji,error.message));
    }
    await db.query('UPDATE nrr_qotd_submissions SET published_channel_id=$2,published_message_id=$3 WHERE id=$1',[id,channel.id,sent.id]);
    await i.update({embeds:[reviewEmbed(row,'approved')],components:reviewButtons(id,true)});
    const submitter = await i.client.users.fetch(row.submitter_id).catch(()=>null);
    await submitter?.send({content:'Your QOTD submission has been approved and published in <#' + channel.id + '>.'}).catch(()=>{});
  }
}
async function onModalUnsafe(i) {
  const [, action, id] = i.customId.split(':');
  if (action === 'finalsubmit') {
    if (!isManager(i)) return i.reply({content:'❌ You do not have permission.',ephemeral:true});
    const r = await db.query('SELECT * FROM nrr_qotd_submissions WHERE id=$1 AND guild_id=$2',[id,i.guildId]);
    const row=r.rows[0]; if(!row || row.status!=='pending') return i.reply({content:'Submission is no longer pending.',ephemeral:true});
    const question=i.fields.getTextInputValue('question').trim();
    const lines=i.fields.getTextInputValue('answers').split('\n').map(x=>x.trim()).filter(Boolean);
    if(!question || lines.length<2 || lines.length>3) return i.reply({content:'Provide a question and 2–3 answer lines.',ephemeral:true});
    const emojis=[],answers=[];
    for(const line of lines){const p=line.match(/^(.+?)\s*:-\s*(.+)$/);if(!p)return i.reply({content:'Use the format emoji :- answer on every line.',ephemeral:true});emojis.push(p[1].trim());answers.push(p[2].trim());}
    await db.query('UPDATE nrr_qotd_submissions SET question=$2,answers=$3::jsonb,emojis=$4::jsonb WHERE id=$1',[id,question,JSON.stringify(answers),JSON.stringify(emojis)]);
    return i.reply({content:'✅ Final QOTD message updated. The review panel is ready for approval.',ephemeral:true});
  }
  const isEdit = id !== 'new';
  if (isEdit && !isManager(i)) return i.reply({content:'❌ You do not have permission to edit this submission.',ephemeral:true});
  const question=i.fields.getTextInputValue('question').trim();
  const answers=i.fields.getTextInputValue('answers').split('\n').map(x=>x.trim()).filter(Boolean);
  const emojis=[1,2,3].map(n=>i.fields.getTextInputValue('emoji'+n).trim());
  if(!question || answers.length<2 || answers.length>3) return i.reply({content:'Please provide a question and 2–3 answer options, each on its own line.',ephemeral:true});
  if(!oneEmoji(emojis[0]) || !oneEmoji(emojis[1])) return i.reply({content:'Please provide one valid emoji for each of the first two answers.',ephemeral:true});
  if(answers.length===3 && !oneEmoji(emojis[2])) return i.reply({content:'Because you provided a third answer, you must also provide its emoji.',ephemeral:true});
  while(emojis.length>answers.length) emojis.pop();
  if(isEdit) {
    await db.query(`UPDATE nrr_qotd_submissions SET question=$2,answers=$3::jsonb,emojis=$4::jsonb
      WHERE id=$1 AND status='pending'`,[id,question,JSON.stringify(answers),JSON.stringify(emojis)]);
    const r=await db.query('SELECT * FROM nrr_qotd_submissions WHERE id=$1',[id]);
    await i.reply({content:'✅ Submission updated.',ephemeral:true});
    const row=r.rows[0]; const c=await i.client.channels.fetch(row.review_channel_id).catch(()=>null);
    const m=await c?.messages.fetch(row.review_message_id).catch(()=>null);
    if(m) await m.edit({embeds:[reviewEmbed(row)],components:reviewButtons(id)});
    return;
  }
  const created=await db.query(`INSERT INTO nrr_qotd_submissions(guild_id,submitter_id,question,answers,emojis)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING *`,[i.guildId,i.user.id,question,JSON.stringify(answers),JSON.stringify(emojis)]);
  const row=created.rows[0];
  const review=await i.client.channels.fetch(REVIEW_CHANNEL_ID).catch(()=>null);
  if(!review?.isTextBased()) {
    await db.query("UPDATE nrr_qotd_submissions SET status='failed' WHERE id=$1",[row.id]);
    return i.reply({content:'❌ The QOTD review channel is unavailable. Please contact an administrator.',ephemeral:true});
  }
  let msg;
  try {
    msg=await review.send({embeds:[reviewEmbed(row)],components:reviewButtons(row.id)});
  } catch (error) {
    console.error('QOTD review channel delivery failed:', {channelId:REVIEW_CHANNEL_ID,submissionId:row.id,error:error?.stack||error});
    await db.query("UPDATE nrr_qotd_submissions SET status='failed' WHERE id=$1",[row.id]).catch(()=>{});
    return i.reply({content:'❌ Your submission was saved, but I could not deliver it to the private review channel. Please notify an administrator to check the bot permissions there.',ephemeral:true});
  }
  await db.query('UPDATE nrr_qotd_submissions SET review_channel_id=$2,review_message_id=$3 WHERE id=$1',[row.id,review.id,msg.id]);
  return i.reply({content:'✅ Your QOTD submission has been sent to the managers for review.',ephemeral:true});
}
async function onModal(i) {
  try {
    return await onModalUnsafe(i);
  } catch (error) {
    console.error('QOTD modal submission failed:', {
      customId: i.customId,
      guildId: i.guildId,
      userId: i.user?.id,
      error: error?.stack || error
    });
    const payload = {content:'❌ Your QOTD submission could not be processed. Please try again in a moment; the issue has been logged for administrators.',ephemeral:true};
    if (i.replied || i.deferred) return i.followUp(payload).catch(()=>{});
    return i.reply(payload).catch(()=>{});
  }
}
module.exports = { migrate, sendPanel, setChannel, onButton, onModal, REVIEW_CHANNEL_ID };
