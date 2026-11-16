const db = require('../db');

async function getRankingContext(guild) {
  const result = await db.query(`
    SELECT user_id,fame,humiliation,(fame-humiliation) AS reputation
    FROM reputation_members
    WHERE guild_id=$1 AND active=TRUE
    ORDER BY (fame-humiliation) DESC,fame DESC,user_id ASC
    LIMIT 5
  `,[guild.id]);
  const total = await db.query(
    'SELECT COUNT(*)::int AS count FROM reputation_members WHERE guild_id=$1 AND active=TRUE',
    [guild.id]
  );
  const members=result.rows.map((row,index)=>{
    const member=guild.members.cache.get(row.user_id);
    const name=member?.displayName||member?.user?.username||'A member';
    return (index+1)+'. '+name+': '+Number(row.reputation)+' reputation ('+
      Number(row.fame)+' fame, '+Number(row.humiliation)+' humiliation)';
  });
  return [
    'NR:R RANKING SYSTEM:',
    'The public member reputation system tracks Fame and Humiliation separately. Net Reputation is Fame minus Humiliation. Public leaderboards can rank by Fame, Humiliation, or net Reputation; departed members are hidden by default.',
    'Current active member records: '+Number(total.rows[0]?.count||0)+'.',
    members.length?'Current top net-Reputation positions:\n'+members.join('\n'):'No public reputation ranking data is currently available.',
    'The staff ranking system is separate: it has message and punishment categories with 7-day, 14-day, and all-time totals. The 7-day period can be reset by authorized staff. Punishment rankings count actions issued by moderators, not actions received. Do not disclose individual staff punishment records or private staff-server information.',
  ].join('\n');
}
module.exports={getRankingContext};
