import USERS_CONTEXT from '../context/usersContext.js';
import { UserContext } from '../typings/UsersContext.js';


export function findUserContext(userName: string): UserContext | null {
  // Direct match
  if (USERS_CONTEXT[userName]) return USERS_CONTEXT[userName];

  // Check aliases
  for (const [_name, context] of Object.entries(USERS_CONTEXT)) {
    if (context.aliases?.includes(userName)) {
      return context;
    }
  }

  return null;
}
