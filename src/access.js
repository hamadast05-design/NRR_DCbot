const SUPERUSER_ID = '1427371780087222463';
const ASSISTANT_HOSTER_MANAGER_ROLE_ID = '1500199643978403930';

function isSuperuser(userOrId) {
  const id = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  return id === SUPERUSER_ID || hasAssistantHosterManagerRole(userOrId);
}

function hasAssistantHosterManagerRole(member) {
  const roleCache = member?.roles?.cache;
  const roleList = Array.isArray(member?.roles) ? member.roles : [];
  return Boolean(roleCache?.has?.(ASSISTANT_HOSTER_MANAGER_ROLE_ID) || roleList.includes(ASSISTANT_HOSTER_MANAGER_ROLE_ID));
}

// Shared feature gate: SuperUser bypasses member-level permissions and role allowlists.
// It does not bypass the bot's own Discord permissions or platform restrictions.
function hasFeatureAccess(userOrId, options = {}) {
  if (isSuperuser(userOrId) || hasAssistantHosterManagerRole(options.member)) return true;
  const permissions = options.memberPermissions || options.member?.permissions;
  if (options.permission && permissions?.has?.(options.permission)) return true;
  const roleCache = options.member?.roles?.cache;
  const roleList = Array.isArray(options.member?.roles) ? options.member.roles : [];
  return (options.roleIds || []).some(roleId => roleCache?.has?.(roleId) || roleList.includes(roleId));
}

function hasPermission(userOrId, memberPermissions, permission, member) {
  return hasFeatureAccess(userOrId, { memberPermissions, permission, member });
}

module.exports = { SUPERUSER_ID, ASSISTANT_HOSTER_MANAGER_ROLE_ID, isSuperuser, hasAssistantHosterManagerRole, hasPermission, hasFeatureAccess };
