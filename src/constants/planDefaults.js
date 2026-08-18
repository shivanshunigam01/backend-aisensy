/** Default pricing catalog — seeded when the plans collection is empty. Mirrors frontend DEFAULT_PRICING_PLANS. */

const BASIC_FEATURES = [
  'WhatsApp bulk messaging',
  'Template campaigns & segments',
  'Shared inbox',
  'Up to 3 users',
  'Email support'
];

const PRO_FEATURES = [
  'Everything in Basic',
  'Meta ads lead sync',
  'Click-to-WhatsApp campaigns',
  'WhatsApp chatbot builder',
  'AI-assisted replies',
  'Human handoff & routing',
  'Priority chat support'
];

const BASIC_ADDONS = [
  {
    id: 'addon-meta-ads',
    name: 'Meta ads lead sync',
    description: 'Send Facebook & Instagram leads into WhatsApp.',
    kind: 'additional',
    priceLabel: '₹4,999/mo',
    amountInPaise: 499900
  },
  {
    id: 'addon-chatbot',
    name: 'WhatsApp chatbot',
    description: 'Automated FAQs, qualification and journeys.',
    kind: 'additional',
    priceLabel: '₹7,999/mo',
    amountInPaise: 799900
  }
];

const PRO_ADDONS = [
  {
    id: 'addon-meta-ads-pro',
    name: 'Meta ads lead sync',
    description: 'Facebook & Instagram campaigns into WhatsApp.',
    kind: 'included',
    priceLabel: '',
    amountInPaise: null
  },
  {
    id: 'addon-chatbot-pro',
    name: 'WhatsApp chatbot',
    description: 'Builder, AI replies and human handoff.',
    kind: 'included',
    priceLabel: '',
    amountInPaise: null
  },
  {
    id: 'addon-success-mgr',
    name: 'Dedicated success manager',
    description: 'Named CSM for onboarding and ongoing support.',
    kind: 'additional',
    priceLabel: '₹9,999/mo',
    amountInPaise: 999900
  }
];

function cloneAddons(addons, suffix) {
  return addons.map((a) => ({ ...a, id: `${a.id}-${suffix}` }));
}

const PLAN_DEFAULTS = [
  {
    id: 'basic-monthly',
    name: 'Basic',
    tier: 'basic',
    billingCycle: 'monthly',
    price: '₹4,999',
    period: '/month',
    amountInPaise: 499900,
    blurb: 'WhatsApp bulk messaging for one team.',
    cta: 'Get started',
    highlighted: false,
    features: [...BASIC_FEATURES],
    addons: cloneAddons(BASIC_ADDONS, 'bm'),
    freeTrialEnabled: true,
    freeTrialDays: 14,
    active: true,
    sortOrder: 10,
    slug: 'basic-monthly'
  },
  {
    id: 'basic-yearly',
    name: 'Basic',
    tier: 'basic',
    billingCycle: 'yearly',
    price: '₹49,990',
    period: '/year',
    amountInPaise: 4999000,
    blurb: 'WhatsApp bulk messaging — 2 months free vs monthly.',
    cta: 'Get started',
    highlighted: false,
    features: [...BASIC_FEATURES],
    addons: cloneAddons(BASIC_ADDONS, 'by'),
    freeTrialEnabled: true,
    freeTrialDays: 14,
    active: true,
    sortOrder: 11,
    slug: 'basic-yearly'
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    tier: 'pro',
    billingCycle: 'monthly',
    price: '₹12,999',
    period: '/month',
    amountInPaise: 1299900,
    blurb: 'Bulk messaging, Meta ads and chatbot in one plan.',
    cta: 'Start Pro',
    highlighted: true,
    features: [...PRO_FEATURES],
    addons: cloneAddons(PRO_ADDONS, 'pm'),
    freeTrialEnabled: true,
    freeTrialDays: 14,
    active: true,
    sortOrder: 20,
    slug: 'pro-monthly'
  },
  {
    id: 'pro-yearly',
    name: 'Pro',
    tier: 'pro',
    billingCycle: 'yearly',
    price: '₹1,29,990',
    period: '/year',
    amountInPaise: 12999000,
    blurb: 'Full stack at a yearly rate — 2 months free vs monthly.',
    cta: 'Start Pro',
    highlighted: true,
    features: [...PRO_FEATURES],
    addons: cloneAddons(PRO_ADDONS, 'py'),
    freeTrialEnabled: true,
    freeTrialDays: 14,
    active: true,
    sortOrder: 21,
    slug: 'pro-yearly'
  }
];

const TRIAL_DEFAULTS = {
  enabled: true,
  days: 14,
  title: '14-day free trial',
  blurb: 'Try Basic features with no credit card. Upgrade to Monthly or Yearly anytime.',
  cta: 'Start free trial',
  features: [
    'Full Basic plan access for 14 days',
    'WhatsApp bulk messaging & shared inbox',
    'No credit card required',
    'Cancel anytime before the trial ends'
  ]
};

module.exports = { PLAN_DEFAULTS, TRIAL_DEFAULTS };
