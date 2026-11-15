// What the virtual users type: search words, chat messages, names and addresses.

export const SEARCH_TERMS = [
  'rolex',
  'submariner',
  'omega',
  'speedmaster',
  'seamaster',
  'tudor',
  'black bay',
  'gmt',
  'daytona',
  'datejust',
  'cartier',
  'chronograph',
  'diver',
  '126610',
  'limited',
];

// Brand slugs, the value of the brand filter.
export const BRAND_SLUGS = ['rolex', 'omega', 'tudor', 'cartier', 'breitling', 'seiko', 'iwc', 'tag-heuer'];

// Price filters in DKK, as [from, to]. null means no limit on that side.
export const PRICE_RANGES_DKK = [
  [null, 25000],
  [25000, 75000],
  [50000, 150000],
  [100000, null],
];

export const CUSTOMER_MESSAGES = [
  'Hi, is this watch still available?',
  'Does it come with the original box and papers?',
  'When was it last serviced?',
  'Can you send a few more photos of the case back and the clasp?',
  'Is the price negotiable?',
  'How long does delivery to Denmark take?',
  'Are there any scratches on the crystal?',
  'Is the bracelet full length, or have links been removed?',
  'Do you offer a warranty on this one?',
  'Thanks, I will think about it and get back to you.',
];

export const ADMIN_REPLIES = [
  'Hi, yes, it is still available.',
  'It comes with the original box and papers.',
  'It was serviced last year and runs within COSC tolerance.',
  'I have added more photos to the listing, have a look.',
  'The price is fixed for this model, sorry.',
  'Delivery within Denmark takes 2 to 3 working days.',
  'The crystal is flawless, there are light hairlines on the clasp only.',
  'All links are included.',
  'Every watch comes with a 12 month warranty.',
  'You are welcome, let me know if you have more questions.',
];

export const CONTACT_MESSAGES = [
  'Do you buy watches as well? I have a Seamaster I would like to sell.',
  'Can I visit your shop to see a watch before I buy it?',
  'I would like to know how your authentication process works.',
  'Do you ship outside the EU?',
  'I am looking for a specific reference, can you source it for me?',
];

export const FIRST_NAMES = ['Anna', 'Mads', 'Sofie', 'Lars', 'Emma', 'Jonas', 'Freja', 'Mikkel', 'Ida', 'Peter'];
export const LAST_NAMES = ['Jensen', 'Nielsen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Rasmussen'];

export const ADDRESSES = [
  { line: 'Guldbergsgade 29N', city: 'Copenhagen', zip: '2200' },
  { line: 'Lygten 37', city: 'Copenhagen', zip: '2400' },
  { line: 'Banegaardspladsen 1', city: 'Aarhus', zip: '8000' },
  { line: 'Vestergade 12', city: 'Odense', zip: '5000' },
  { line: 'Boulevarden 3', city: 'Aalborg', zip: '9000' },
  { line: 'Torvet 5', city: 'Roskilde', zip: '4000' },
];

// A 1x1 pixel PNG, uploaded as the profile picture.
export const AVATAR_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
