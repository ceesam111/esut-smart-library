export interface Newspaper {
  id: number;
  name: string;
  url: string;
  description: string;
  zone: string;
  state: string;
  country: string;
  continent: string;
  category: string;
  language: string;
}

export const COUNTRY_FLAGS: Record<string, string> = {
  Nigeria: '🇳🇬',
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  Kenya: '🇰🇪',
  'South Africa': '🇿🇦',
  Qatar: '🇶🇦',
  Germany: '🇩🇪',
  France: '🇫🇷',
  'Pan-African': '🌍',
  International: '🌐',
};

export const flagFor = (country: string): string => COUNTRY_FLAGS[country] ?? '🗞️';

export const newspapersData: Newspaper[] = [
  // NORTH-WEST
  { id: 1, name: 'Daily Trust', url: 'https://dailytrust.com', description: 'Kaduna — premier northern national daily', zone: 'North-West', state: 'Kaduna', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 2, name: 'New Nigerian', url: 'https://www.newnigeriannewspapers.ng', description: 'Kaduna — owned by 19 northern governors', zone: 'North-West', state: 'Kaduna', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 3, name: 'Aminiya', url: 'https://aminiya.dailytrust.com', description: 'Hausa-language daily', zone: 'North-West', state: 'Kaduna', country: 'Nigeria', continent: 'Africa', category: 'Hausa-Language', language: 'Hausa' },
  { id: 4, name: 'Al-Mizan', url: 'https://www.almizan.ng', description: 'Zaria — Hausa-language; est. 1991', zone: 'North-West', state: 'Kaduna', country: 'Nigeria', continent: 'Africa', category: 'Hausa-Language', language: 'Hausa' },
  { id: 5, name: 'Blueprint', url: 'https://www.blueprint.ng', description: 'Abuja/northern focus', zone: 'North-West', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 6, name: 'Daily Nigerian', url: 'https://dailynigerian.com', description: 'Abuja — independent; northern politics', zone: 'North-West', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 7, name: 'Dateline Nigeria', url: 'https://www.dateline.ng', description: 'Abuja — English and Hausa editions', zone: 'North-West', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 8, name: 'Leadership', url: 'https://leadership.ng', description: 'Abuja — national daily; northern readership', zone: 'North-West', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },

  // NORTH-EAST
  { id: 9, name: 'Taraba Truth & Facts', url: 'https://www.tarabatruthandfact.com.ng', description: 'Jalingo — publisher runs Rock FM Jalingo', zone: 'North-East', state: 'Taraba', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 10, name: 'HumAngle', url: 'https://humanglemedia.com', description: 'Conflict, humanitarian and NE insecurity focus', zone: 'North-East', state: 'Borno', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 11, name: 'Wikki Times', url: 'https://wikkitimes.com', description: 'Bauchi — investigative; fact-check section', zone: 'North-East', state: 'Bauchi', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 12, name: 'Peoples Daily', url: 'https://peoplesdailyng.com', description: 'Abuja — northern general coverage', zone: 'North-East', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 13, name: 'Fombina FM Yola', url: 'https://fombinafmyola.com.ng', description: 'Adamawa — English, Hausa and Fulfulde', zone: 'North-East', state: 'Adamawa', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },

  // NORTH-CENTRAL
  { id: 14, name: 'Premium Times', url: 'https://www.premiumtimesng.com', description: 'Abuja — award-winning investigative journalism', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 15, name: 'Daily Post', url: 'https://dailypost.ng', description: 'Abuja — fast-breaking news', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 16, name: 'National Record', url: 'https://nationalrecord.com.ng', description: 'Abuja — labour and governance', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Government & Wire Service', language: 'English' },
  { id: 17, name: 'NewsDigest', url: 'https://newsdigest.ng', description: 'Abuja — higher education focus', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 18, name: 'Sundiata Post', url: 'https://sundiatapost.com', description: 'Abuja — nonpartisan; offices in London and Washington DC', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 19, name: 'Peoples Gazette', url: 'https://gazettengr.com', description: 'Abuja — investigative; launched 2020', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 20, name: 'Swift Reporters', url: 'https://swiftreporters.com', description: 'Abuja — oil, gas, education, security', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 21, name: 'Intervention', url: 'https://intervention.ng', description: 'Abuja — current affairs and commentary', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 22, name: 'Dataphyte', url: 'https://www.dataphyte.com', description: 'Abuja — data journalism and governance', zone: 'North-Central', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },

  // SOUTH-WEST
  { id: 23, name: 'The Punch', url: 'https://punchng.com', description: 'Ogun/Lagos — highest-circulation daily; est. 1971', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 24, name: 'Vanguard', url: 'https://www.vanguardngr.com', description: 'Lagos — national daily; est. 1984', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 25, name: 'The Guardian Nigeria', url: 'https://guardian.ng', description: 'Lagos — national broadsheet', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 26, name: 'The Nation', url: 'https://thenationonlineng.net', description: 'Lagos — strong South-West reach', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 27, name: 'Nigerian Tribune', url: 'https://www.tribuneonlineng.com', description: 'Ibadan — oldest private Nigerian daily; est. 1949', zone: 'South-West', state: 'Oyo', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 28, name: 'ThisDay', url: 'https://www.thisdaylive.com', description: 'Lagos — business, politics, policy; est. 1995', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Business & Finance', language: 'English' },
  { id: 29, name: 'Daily Sun', url: 'https://www.sunnewsonline.com', description: 'Lagos — mass-market daily; est. 2003', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 30, name: 'Daily Times', url: 'https://dailytimesng.com', description: 'Lagos — legacy brand; est. 1926', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 31, name: 'BusinessDay', url: 'https://businessday.ng', description: 'Lagos — financial and business daily; est. 2001', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Business & Finance', language: 'English' },
  { id: 32, name: 'PM News', url: 'https://www.pmnewsnigeria.com', description: 'Lagos — evening newspaper; est. 1994', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 33, name: 'The Cable', url: 'https://www.thecable.ng', description: 'Lagos — investigative policy journalism; est. 2011', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 34, name: 'Ripples Nigeria', url: 'https://www.ripplesnigeria.com', description: 'Lagos — politics and economy; est. 2015', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 35, name: 'Pulse Nigeria', url: 'https://www.pulse.ng', description: 'Lagos — entertainment, lifestyle and news', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Entertainment & Lifestyle', language: 'English' },
  { id: 36, name: 'Tell Magazine', url: 'https://tell.ng', description: 'Lagos — weekly news magazine; est. 1991', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 37, name: 'Nigerian Concord', url: 'https://www.nigerianconcord.com.ng', description: 'Akure, Ondo State', zone: 'South-West', state: 'Ondo', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 38, name: 'National Daily', url: 'https://www.nationaldailyng.com', description: 'Lagos — print and web; est. 2006', zone: 'South-West', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },

  // SOUTH-EAST
  { id: 39, name: '247 UReports', url: 'https://247ureports.com', description: 'Anambra-focused South-East news', zone: 'South-East', state: 'Anambra', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 40, name: 'The Will Nigeria', url: 'https://thewillnigeria.com', description: 'National online newspaper', zone: 'South-East', state: 'National', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 41, name: 'African Examiner', url: 'https://www.africanexaminer.com', description: 'Baltimore — South-East diaspora content', zone: 'South-East', state: 'International', country: 'United States', continent: 'North America', category: 'Diaspora', language: 'English' },
  { id: 42, name: 'Sahara Reporters', url: 'https://saharareporters.com', description: 'Citizen investigative journalism', zone: 'South-East', state: 'National', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 43, name: 'Legit.ng', url: 'https://www.legit.ng', description: 'Lagos — mass national reach', zone: 'South-East', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 44, name: 'Odogwu Blog', url: 'https://www.odogwublog.com', description: 'Igbo cultural and news awareness', zone: 'South-East', state: 'National', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },

  // SOUTH-SOUTH
  { id: 45, name: 'Nigerian Observer', url: 'https://nigerianobservernews.com', description: 'Benin City — est. 1968', zone: 'South-South', state: 'Edo', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 46, name: 'The Tide', url: 'https://www.thetidenewsonline.com', description: 'Port Harcourt — Rivers State Newspaper Corporation', zone: 'South-South', state: 'Rivers', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 47, name: 'Cross River Watch', url: 'https://crossriverwatch.com', description: 'Calabar — Cross River State', zone: 'South-South', state: 'Cross River', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 48, name: 'Niger Delta Standard', url: 'https://www.nigerdeltastandard.com', description: 'Multi-state South-South coverage', zone: 'South-South', state: 'Delta', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 49, name: 'Port Harcourt Telegraph', url: 'https://phctelegraph.info', description: 'Rivers State — print and online', zone: 'South-South', state: 'Rivers', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 50, name: 'Prime 9ja Online', url: 'https://www.prime9ja.com.ng', description: 'Edo State — independent news', zone: 'South-South', state: 'Edo', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 51, name: 'Realnews Magazine', url: 'https://realnewsmagazine.net', description: 'South-South politics and economy', zone: 'South-South', state: 'Rivers', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },

  // NATIONAL
  { id: 52, name: 'Channels TV News', url: 'https://www.channelstv.com', description: 'Lagos — most-trusted TV news brand', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Government & Wire Service', language: 'English' },
  { id: 53, name: 'New Telegraph', url: 'https://www.newtelegraphng.com', description: 'Business, politics, education, sport', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 54, name: 'Daily Independent', url: 'https://www.independent.ng', description: 'Ikeja — political and business daily; est. 2001', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Business & Finance', language: 'English' },
  { id: 55, name: 'News Agency of Nigeria', url: 'https://nannews.ng', description: 'Government wire service; Abuja', zone: 'National', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Government & Wire Service', language: 'English' },
  { id: 56, name: 'The Eagle Online', url: 'https://theeagleonline.com.ng', description: 'National — est. 2011', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 57, name: 'Nairametrics', url: 'https://nairametrics.com', description: 'Lagos — financial markets and business data', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Business & Finance', language: 'English' },
  { id: 58, name: 'Nigerian NewsDirect', url: 'https://nigeriannewsdirect.com', description: 'Oil, gas, infotech, business, sport', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Business & Finance', language: 'English' },
  { id: 59, name: 'The News Nigeria', url: 'https://thenewsnigeria.com.ng', description: 'Lagos — weekly magazine', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 60, name: 'ICIR Nigeria', url: 'https://www.icirnigeria.org', description: 'Independent non-profit investigative journalism', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 61, name: 'FIJ Nigeria', url: 'https://fij.ng', description: 'Non-profit — police abuse, scams, financial crime', zone: 'National', state: 'Lagos', country: 'Nigeria', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 62, name: 'Voice of Nigeria', url: 'https://www.von.gov.ng', description: 'State-owned; English, Hausa, Igbo, Yoruba, Arabic, French', zone: 'National', state: 'Abuja', country: 'Nigeria', continent: 'Africa', category: 'Government & Wire Service', language: 'English' },

  // UK
  { id: 63, name: 'BBC News', url: 'https://www.bbc.co.uk/news', description: 'Most-accessed international source among Nigerians', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 64, name: 'The Guardian UK', url: 'https://www.theguardian.com', description: 'Quality broadsheet; strong Africa coverage', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 65, name: 'Financial Times', url: 'https://www.ft.com', description: 'Global financial and business daily', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'Business & Finance', language: 'English' },
  { id: 66, name: 'The Times UK', url: 'https://www.thetimes.co.uk', description: 'Flagship quality paper; Africa desk', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 67, name: 'The Telegraph', url: 'https://www.telegraph.co.uk', description: 'Conservative broadsheet; Africa correspondents', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 68, name: 'The Independent UK', url: 'https://www.independent.co.uk', description: 'Online-only broadsheet; international focus', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 69, name: 'Daily Mail', url: 'https://www.dailymail.co.uk', description: 'Mass-market; high online traffic', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 70, name: 'Nigerian Watch UK', url: 'https://www.nigerianwatch.com', description: 'London — Nigerian diaspora', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'Diaspora', language: 'English' },

  // US
  { id: 71, name: 'CNN', url: 'https://www.cnn.com', description: 'Most-watched US TV news; international edition', zone: 'International', state: 'Atlanta', country: 'United States', continent: 'North America', category: 'General News', language: 'English' },
  { id: 72, name: 'New York Times', url: 'https://www.nytimes.com', description: 'Global newspaper of record', zone: 'International', state: 'New York', country: 'United States', continent: 'North America', category: 'General News', language: 'English' },
  { id: 73, name: 'Washington Post', url: 'https://www.washingtonpost.com', description: 'Politics and global affairs', zone: 'International', state: 'Washington DC', country: 'United States', continent: 'North America', category: 'General News', language: 'English' },
  { id: 74, name: 'Wall Street Journal', url: 'https://www.wsj.com', description: 'Global financial and business daily', zone: 'International', state: 'New York', country: 'United States', continent: 'North America', category: 'Business & Finance', language: 'English' },
  { id: 75, name: 'USA Today', url: 'https://www.usatoday.com', description: 'Nationwide general interest paper', zone: 'International', state: 'McLean', country: 'United States', continent: 'North America', category: 'General News', language: 'English' },
  { id: 76, name: 'USAfrica Online', url: 'http://www.usafricaonline.com', description: 'Houston — Nigeria and US-Africa relations', zone: 'International', state: 'Houston', country: 'United States', continent: 'North America', category: 'Diaspora', language: 'English' },

  // AFRICA
  { id: 77, name: 'AllAfrica', url: 'https://allafrica.com', description: 'Continental aggregator; active Nigeria section', zone: 'International', state: 'International', country: 'Pan-African', continent: 'Africa', category: 'Pan-African', language: 'English' },
  { id: 78, name: 'The East African', url: 'https://www.theeastafrican.co.ke', description: 'Nairobi — regional English weekly', zone: 'International', state: 'Nairobi', country: 'Kenya', continent: 'Africa', category: 'Pan-African', language: 'English' },
  { id: 79, name: 'Daily Nation Kenya', url: 'https://nation.africa', description: 'Nairobi — largest East African daily', zone: 'International', state: 'Nairobi', country: 'Kenya', continent: 'Africa', category: 'General News', language: 'English' },
  { id: 80, name: 'Mail & Guardian SA', url: 'https://mg.co.za', description: 'Johannesburg — investigative; pan-Africa coverage', zone: 'International', state: 'Johannesburg', country: 'South Africa', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 81, name: 'Daily Maverick SA', url: 'https://www.dailymaverick.co.za', description: 'South Africa — award-winning investigative journalism', zone: 'International', state: 'Cape Town', country: 'South Africa', continent: 'Africa', category: 'Investigative', language: 'English' },
  { id: 82, name: 'The Continent', url: 'https://thecontinent.org', description: 'Pan-African weekly; English, French, Portuguese', zone: 'International', state: 'International', country: 'Pan-African', continent: 'Africa', category: 'Pan-African', language: 'English' },
  { id: 83, name: 'Reuters Africa', url: 'https://www.reuters.com/world/africa/', description: 'Global wire; Nigeria bureau in Lagos', zone: 'International', state: 'International', country: 'International', continent: 'Africa', category: 'Government & Wire Service', language: 'English' },

  // EUROPE & MIDDLE EAST
  { id: 84, name: 'Al Jazeera English', url: 'https://www.aljazeera.com', description: 'Doha — strong West Africa and Nigeria bureau', zone: 'International', state: 'Doha', country: 'Qatar', continent: 'Asia', category: 'General News', language: 'English' },
  { id: 85, name: 'Deutsche Welle', url: 'https://www.dw.com/en/africa', description: 'Germany — English, French, Hausa, Swahili Africa desk', zone: 'International', state: 'Bonn', country: 'Germany', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 86, name: 'France 24 English', url: 'https://www.france24.com/en', description: 'Paris — 24-hour news; Francophone Africa', zone: 'International', state: 'Paris', country: 'France', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 87, name: 'Voice of America', url: 'https://www.voanews.com', description: 'US government-funded; Hausa Service for Nigeria', zone: 'International', state: 'Washington DC', country: 'United States', continent: 'North America', category: 'Government & Wire Service', language: 'English' },
  { id: 88, name: 'RFI English', url: 'https://www.rfi.fr/en', description: 'Radio France Internationale; Africa correspondents', zone: 'International', state: 'Paris', country: 'France', continent: 'Europe', category: 'General News', language: 'English' },
  { id: 89, name: 'The Economist', url: 'https://www.economist.com', description: 'London — Nigeria economic and political analysis', zone: 'International', state: 'London', country: 'United Kingdom', continent: 'Europe', category: 'Business & Finance', language: 'English' },
];
