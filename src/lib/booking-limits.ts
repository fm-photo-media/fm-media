// SEC-4 / QA-9: hard caps on every free-text booking field. Shared by the zod
// schema (server) and the form's maxLength attributes (client), without pulling
// zod into the client bundle.
export const BOOKING_LIMITS = {
  name: 120,
  email: 254,
  phone: 30,
  agencyName: 160,
  propertyAddress: 300,
  squareFeet: 20,
  message: 4000
} as const;
