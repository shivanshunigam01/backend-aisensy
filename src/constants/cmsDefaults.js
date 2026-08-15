/** Default CMS document — seeded on first boot. Mirrors frontend DEFAULT_CMS shape. */
const CMS_DEFAULTS = {
  hero: {
    headline: 'Grow Your Business with AI-Powered Solutions',
    tagline: 'Zentroverse Global',
    subheadline: 'Digital marketing, CRM, ERP, WhatsApp automation & dealer network expansion.'
  },
  meta: {
    title: 'Zentroverse Global | AI Business Growth, CRM, ERP & WhatsApp API',
    description:
      'Zentroverse Global provides digital marketing, CRM, ERP, WhatsApp API, lead management, business automation and dealer network expansion solutions.'
  },
  company: {
    legalName: 'Zentroverse Global Pvt. Ltd.',
    tagline: 'AI-Powered Business Growth Partner',
    address: '405, B-Block, Shyam Yash Enclave,\nSheikhpura, Phulwari,\nPatna, Bihar 800014, India',
    gstin: '10AACCZ7470L1Z3',
    email: 'digital@zentroverse.com',
    website: 'https://zentroverse.com',
    phone: '+91 99999 99999',
    whatsappNumber: '919999999999',
    whatsappMessage: "Hi Zentroverse, I'd like to learn more about your business growth solutions.",
    hours: 'Mon–Sat, 10am–7pm IST',
    bankName: '',
    accountName: 'Zentroverse Global Pvt. Ltd.',
    accountNumber: '',
    ifsc: '',
    upi: '',
    social: [
      { platform: 'linkedin', url: '' },
      { platform: 'instagram', url: '' },
      { platform: 'twitter', url: '' },
      { platform: 'facebook', url: '' },
      { platform: 'youtube', url: '' }
    ]
  },
  galleryCategories: [
    'Client Meetings',
    'Dealer Events',
    'Training Programs',
    'Digital Campaigns',
    'Network Expansion Activities',
    'Field Activities',
    'Product Demos'
  ],
  works: [],
  caseStudies: [
    {
      id: 'cs-1',
      title: 'EV Network Expansion for ZFORCE',
      problem: 'New brand with limited dealer presence.',
      solution: 'Market mapping, dealer scouting, partner engagement.',
      outcome: '6 dealers onboarded and 20 prospects under engagement.',
      tags: ['Network Expansion', 'EV'],
      imageUrl: ''
    }
  ],
  testimonials: [
    {
      id: 't-1',
      quote: 'We improved our lead engagement and conversion process significantly through Zentroverse solutions.',
      name: 'Rajesh Kumar',
      company: 'Multi-brand Automotive Dealer',
      designation: 'Managing Director',
      rating: 5,
      mediaType: 'video',
      videoUrl: '',
      thumbnailUrl: ''
    }
  ],
  gallery: [],
  productDemos: [],
  faqs: [
    {
      question: 'What services does Zentroverse offer?',
      answer: 'Digital marketing, CRM, ERP, WhatsApp automation, lead management, and dealer network expansion.'
    }
  ],
  updatedAt: null
};

module.exports = { CMS_DEFAULTS };
