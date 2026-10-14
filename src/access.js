const SUPERUSER_ID = '1427371780087222463';

function isSuperuser(userOrId) {
  const id = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  return id === SUPERUSER_ID;
}

function hasPermission(userOrId, memberPermissions, permission) {
  return isSuperuser(userOrId) || Boolean(memberPermissions?.has?.(permission));
}

module.exports = { SUPERUSER_ID, isSuperuser, hasPermission };
