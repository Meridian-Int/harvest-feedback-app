import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'feedbackMedia',
  access: (allow) => ({
    'feedback-media/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['admins']).to(['read']),
    ],
  }),
});
