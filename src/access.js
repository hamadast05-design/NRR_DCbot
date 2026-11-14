const SUPERUSER_ID = '1427371780087222463';

function isSuperuser(userOrId) {
  const id = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  return id === SUPERUSER_ID;
}

// Shared feature gate: SuperUser bypasses member-level permissions and role allowlists.
// It does not bypass the bot's own Discord permissions or platform restrictions.
function hasFeatureAccess(userOrId, options = {}) {
  if (isSuperuser(userOrId)) return true;
  const permissions = options.memberPermissions || options.member?.permissions;
  if (options.permission && permissions?.has?.(options.permission)) return true;
  const roleCache = options.member?.roles?.cache;
  const roleList = Array.isArray(options.member?.roles) ? options.member.roles : [];
  return (options.roleIds || []).some(roleId => roleCache?.has?.(roleId) || roleList.includes(roleId));
}

function hasPermission(userOrId, memberPermissions, permission) {
  return hasFeatureAccess(userOrId, { memberPermissions, permission });
}

module.exports = { SUPERUSER_ID, isSuperuser, hasPermission, hasFeatureAccess };
