// Currencies offered in the app. Codes match the exchange-rate API (https://github.com/fawazahmed0/exchange-api),
// which is listed in the public-apis catalog (Currency Exchange) — free, no API key, no rate limits.
// `symbol` is what is shown in front of amounts; ambiguous symbols use a short prefix ($ → A$, C$, …).
export const CURRENCIES = [
  { code: 'MUR', name: 'Mauritian Rupee',        symbol: 'Rs'   },
  { code: 'USD', name: 'US Dollar',              symbol: '$'    },
  { code: 'EUR', name: 'Euro',                   symbol: '€'    },
  { code: 'GBP', name: 'British Pound',          symbol: '£'    },
  { code: 'INR', name: 'Indian Rupee',           symbol: '₹'    },
  { code: 'ZAR', name: 'South African Rand',     symbol: 'R'    },
  { code: 'AED', name: 'UAE Dirham',             symbol: 'AED'  },
  { code: 'AUD', name: 'Australian Dollar',      symbol: 'A$'   },
  { code: 'CAD', name: 'Canadian Dollar',        symbol: 'C$'   },
  { code: 'CHF', name: 'Swiss Franc',            symbol: 'CHF'  },
  { code: 'CNY', name: 'Chinese Yuan',           symbol: 'CN¥'  },
  { code: 'JPY', name: 'Japanese Yen',           symbol: '¥'    },
  { code: 'SGD', name: 'Singapore Dollar',       symbol: 'S$'   },
  { code: 'HKD', name: 'Hong Kong Dollar',       symbol: 'HK$'  },
  { code: 'NZD', name: 'New Zealand Dollar',     symbol: 'NZ$'  },
  { code: 'SEK', name: 'Swedish Krona',          symbol: 'kr'   },
  { code: 'NOK', name: 'Norwegian Krone',        symbol: 'NOK'  },
  { code: 'DKK', name: 'Danish Krone',           symbol: 'DKK'  },
  { code: 'PLN', name: 'Polish Złoty',           symbol: 'zł'   },
  { code: 'CZK', name: 'Czech Koruna',           symbol: 'Kč'   },
  { code: 'HUF', name: 'Hungarian Forint',       symbol: 'Ft'   },
  { code: 'RON', name: 'Romanian Leu',           symbol: 'lei'  },
  { code: 'TRY', name: 'Turkish Lira',           symbol: '₺'    },
  { code: 'RUB', name: 'Russian Ruble',          symbol: '₽'    },
  { code: 'UAH', name: 'Ukrainian Hryvnia',      symbol: '₴'    },
  { code: 'BRL', name: 'Brazilian Real',         symbol: 'R$'   },
  { code: 'MXN', name: 'Mexican Peso',           symbol: 'MX$'  },
  { code: 'ARS', name: 'Argentine Peso',         symbol: 'ARS'  },
  { code: 'CLP', name: 'Chilean Peso',           symbol: 'CLP'  },
  { code: 'COP', name: 'Colombian Peso',         symbol: 'COP'  },
  { code: 'PEN', name: 'Peruvian Sol',           symbol: 'S/'   },
  { code: 'KRW', name: 'South Korean Won',       symbol: '₩'    },
  { code: 'TWD', name: 'New Taiwan Dollar',      symbol: 'NT$'  },
  { code: 'THB', name: 'Thai Baht',              symbol: '฿'    },
  { code: 'MYR', name: 'Malaysian Ringgit',      symbol: 'RM'   },
  { code: 'IDR', name: 'Indonesian Rupiah',      symbol: 'Rp'   },
  { code: 'PHP', name: 'Philippine Peso',        symbol: '₱'    },
  { code: 'VND', name: 'Vietnamese Dong',        symbol: '₫'    },
  { code: 'PKR', name: 'Pakistani Rupee',        symbol: 'PKR'  },
  { code: 'BDT', name: 'Bangladeshi Taka',       symbol: '৳'    },
  { code: 'LKR', name: 'Sri Lankan Rupee',       symbol: 'LKR'  },
  { code: 'NPR', name: 'Nepalese Rupee',         symbol: 'NPR'  },
  { code: 'SAR', name: 'Saudi Riyal',            symbol: 'SAR'  },
  { code: 'QAR', name: 'Qatari Riyal',           symbol: 'QAR'  },
  { code: 'KWD', name: 'Kuwaiti Dinar',          symbol: 'KWD'  },
  { code: 'OMR', name: 'Omani Rial',             symbol: 'OMR'  },
  { code: 'ILS', name: 'Israeli Shekel',         symbol: '₪'    },
  { code: 'EGP', name: 'Egyptian Pound',         symbol: 'E£'   },
  { code: 'MAD', name: 'Moroccan Dirham',        symbol: 'MAD'  },
  { code: 'NGN', name: 'Nigerian Naira',         symbol: '₦'    },
  { code: 'KES', name: 'Kenyan Shilling',        symbol: 'KSh'  },
  { code: 'GHS', name: 'Ghanaian Cedi',          symbol: 'GH₵'  },
  { code: 'TZS', name: 'Tanzanian Shilling',     symbol: 'TSh'  },
  { code: 'MGA', name: 'Malagasy Ariary',        symbol: 'Ar'   },
  { code: 'SCR', name: 'Seychellois Rupee',      symbol: 'SCR'  },
  { code: 'MVR', name: 'Maldivian Rufiyaa',      symbol: 'MVR'  },
];

const BY_CODE = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));

export function findCurrency(code) {
  return BY_CODE[(code || '').toUpperCase()] || null;
}

// What is printed in front of amounts for a currency code
export function currencyLabel(code) {
  return findCurrency(code)?.symbol || (code || '').toUpperCase();
}

// Existing data only stores a label such as "Rs". Work out which currency it meant.
// "Rs" maps to the Mauritian Rupee (this app's home market); the user can change it in Settings.
export function codeForLabel(label) {
  if (!label) return null;
  const hit = CURRENCIES.find(c => c.symbol === label) || CURRENCIES.find(c => c.code === String(label).toUpperCase());
  return hit ? hit.code : null;
}
