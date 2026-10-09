import { ASSIGNEES, PERSONAS, PRIORITIES, PRODUCT_AREAS, SENTRY_PROJECTS, SEVERITIES, STATUSES } from './options';

it('keeps the exact shared option order and labels', () => {
  expect({ PRODUCT_AREAS, PRIORITIES, SEVERITIES, STATUSES, PERSONAS, SENTRY_PROJECTS, ASSIGNEES }).toMatchInlineSnapshot(`
    {
      "ASSIGNEES": [
        {
          "label": "Unassigned",
          "value": "",
        },
        {
          "label": "Admin",
          "value": "admin@example.com",
        },
      ],
      "PERSONAS": [
        "Company",
        "Partner",
        "Operator",
      ],
      "PRIORITIES": [
        "Blocker",
        "Bug",
        "Improvement",
      ],
      "PRODUCT_AREAS": [
        "Onboarding",
        "Data room",
        "Payment — payout account setup",
        "Payment — payout status or delay",
        "Payment — amount or calculation",
        "Payment — failed or missing payout",
        "Payment — confirmation or receipt",
        "Partner portfolio",
        "Operations console",
        "Other — add an area",
      ],
      "SENTRY_PROJECTS": [
        "harvest-ui",
        "harvest-api",
        "feedback-app",
      ],
      "SEVERITIES": [
        "Critical",
        "Medium",
        "Low",
      ],
      "STATUSES": [
        "New",
        "Assigned",
        "In progress",
        "Closed",
      ],
    }
  `);
  expect(SEVERITIES).not.toContain('Blocker');
});
