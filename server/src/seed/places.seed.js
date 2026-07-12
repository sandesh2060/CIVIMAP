// file: server/src/seed/places.seed.js
// Seeds ~230 real Kathmandu Valley locations across 12 categories.
// Run: node src/seed/places.seed.js
//
// Coordinates are best-effort approximations of real KTM Valley locations —
// accurate enough for map display/demo purposes, not survey-grade.

const mongoose = require("mongoose");
require("dotenv").config();
const Place = require("../models/Place");
const Admin = require("../models/admin/Admin");

const PLACES = [
  // ---------------- SCHOOL ----------------
  { name: "Rato Bangala School", category: "school", location: { lat: 27.6742, lng: 85.3188 }, description: "Private school, Patan" },
  { name: "St. Xavier's School", category: "school", location: { lat: 27.6701, lng: 85.3125 }, description: "Jawalakhel" },
  { name: "Budhanilkantha School", category: "school", location: { lat: 27.7910, lng: 85.3620 }, description: "Budhanilkantha" },
  { name: "Ullens School", category: "school", location: { lat: 27.6788, lng: 85.3060 }, description: "Sanepa" },
  { name: "GEMS School", category: "school", location: { lat: 27.7365, lng: 85.3220 }, description: "Dhapasi" },
  { name: "Little Angels' College", category: "school", location: { lat: 27.6595, lng: 85.3390 }, description: "Hattiban" },
  { name: "Trinity International School", category: "school", location: { lat: 27.7108, lng: 85.3280 }, description: "Dillibazar" },
  { name: "DAV Sushil Kedia Vishwa Bharati", category: "school", location: { lat: 27.6890, lng: 85.3390 }, description: "New Baneshwor" },
  { name: "Kathmandu Model Secondary School", category: "school", location: { lat: 27.7060, lng: 85.3140 }, description: "Bagbazar" },
  { name: "Adarsha Vidya Mandir", category: "school", location: { lat: 27.6970, lng: 85.3010 }, description: "Kalimati" },
  { name: "Pentagon International School", category: "school", location: { lat: 27.7280, lng: 85.3120 }, description: "Nayabazar" },
  { name: "Malpi International School", category: "school", location: { lat: 27.7290, lng: 85.3330 }, description: "Baluwatar" },
  { name: "Vidyodaya Secondary School", category: "school", location: { lat: 27.6810, lng: 85.3200 }, description: "Lalitpur" },
  { name: "Siddhartha Vanasthali Institute", category: "school", location: { lat: 27.6990, lng: 85.2830 }, description: "Bafal" },
  { name: "Nightingale International School", category: "school", location: { lat: 27.6935, lng: 85.3430 }, description: "Old Baneshwor" },
  { name: "Kathmandu World School", category: "school", location: { lat: 27.6790, lng: 85.3890 }, description: "Lokanthali, Bhaktapur" },
  { name: "Deep Ratna Higher Secondary School", category: "school", location: { lat: 27.6780, lng: 85.2830 }, description: "Kirtipur" },
  { name: "Gyanodaya Bal Batika", category: "school", location: { lat: 27.6720, lng: 85.4280 }, description: "Bhaktapur" },
  { name: "Sacred Heart School", category: "school", location: { lat: 27.6715, lng: 85.3140 }, description: "Jawalakhel" },
  { name: "Kathmandu University High School", category: "school", location: { lat: 27.6205, lng: 85.5388 }, description: "Dhulikhel" },
   { name: "Orchid Internation College", category: "school", location: { lat: 27.7024, lng: 85.3465 }, description: "Gaushala Bijayachowk Battisputali" },

  // ---------------- HISTORICAL ----------------
  { name: "Kathmandu Durbar Square", category: "historical", location: { lat: 27.7040, lng: 85.3070 }, description: "UNESCO World Heritage Site" },
  { name: "Patan Durbar Square", category: "historical", location: { lat: 27.6727, lng: 85.3250 }, description: "UNESCO World Heritage Site" },
  { name: "Bhaktapur Durbar Square", category: "historical", location: { lat: 27.6722, lng: 85.4280 }, description: "UNESCO World Heritage Site" },
  { name: "Swayambhunath Stupa", category: "historical", location: { lat: 27.7149, lng: 85.2903 }, description: "Monkey Temple" },
  { name: "Boudhanath Stupa", category: "historical", location: { lat: 27.7215, lng: 85.3620 }, description: "UNESCO World Heritage Site" },
  { name: "Pashupatinath Temple", category: "historical", location: { lat: 27.7107, lng: 85.3487 }, description: "UNESCO World Heritage Site" },
  { name: "Changu Narayan Temple", category: "historical", location: { lat: 27.7167, lng: 85.4283 }, description: "Oldest temple in Nepal" },
  { name: "Kumari Ghar", category: "historical", location: { lat: 27.7042, lng: 85.3075 }, description: "Living Goddess residence" },
  { name: "Taleju Temple", category: "historical", location: { lat: 27.7045, lng: 85.3078 }, description: "Kathmandu Durbar Square" },
  { name: "Nyatapola Temple", category: "historical", location: { lat: 27.6715, lng: 85.4295 }, description: "Bhaktapur" },
  { name: "Dattatreya Temple", category: "historical", location: { lat: 27.6730, lng: 85.4310 }, description: "Bhaktapur" },
  { name: "Bagh Bhairab Temple", category: "historical", location: { lat: 27.6775, lng: 85.2830 }, description: "Kirtipur" },
  { name: "Krishna Mandir", category: "historical", location: { lat: 27.6725, lng: 85.3252 }, description: "Patan Durbar Square" },
  { name: "Hanuman Dhoka Palace", category: "historical", location: { lat: 27.7042, lng: 85.3072 }, description: "Old royal palace" },
  { name: "Garden of Dreams", category: "historical", location: { lat: 27.7145, lng: 85.3160 }, description: "Neo-classical garden, Kaiser Mahal" },
  { name: "Rani Pokhari", category: "historical", location: { lat: 27.7060, lng: 85.3140 }, description: "Historic pond" },
  { name: "Chabahil Stupa", category: "historical", location: { lat: 27.7175, lng: 85.3465 }, description: "Chabahil" },
  { name: "Ichangu Narayan Temple", category: "historical", location: { lat: 27.7350, lng: 85.2680 }, description: "Ichangu" },
  { name: "Dakshinkali Temple", category: "historical", location: { lat: 27.5985, lng: 85.2790 }, description: "Sacrificial temple" },
  { name: "Budhanilkantha (Sleeping Vishnu)", category: "historical", location: { lat: 27.7660, lng: 85.3620 }, description: "Stone Vishnu statue" },

  // ---------------- LIBRARY ----------------
  { name: "Tribhuvan University Central Library", category: "library", location: { lat: 27.6784, lng: 85.2870 }, description: "Kirtipur" },
  { name: "Nepal National Library", category: "library", location: { lat: 27.6660, lng: 85.3210 }, description: "Harihar Bhawan, Lalitpur" },
  { name: "Kaiser Library", category: "library", location: { lat: 27.7145, lng: 85.3155 }, description: "Kaiser Mahal, Kathmandu" },
  { name: "Madan Puraskar Pustakalaya", category: "library", location: { lat: 27.6690, lng: 85.3240 }, description: "Patan" },
  { name: "British Council Library", category: "library", location: { lat: 27.7185, lng: 85.3175 }, description: "Lainchaur" },
  { name: "Patan Library", category: "library", location: { lat: 27.6730, lng: 85.3255 }, description: "Mangal Bazar" },
  { name: "Bhaktapur Public Library", category: "library", location: { lat: 27.6725, lng: 85.4270 }, description: "Bhaktapur" },
  { name: "Community Library Kirtipur", category: "library", location: { lat: 27.6790, lng: 85.2840 }, description: "Kirtipur" },
  { name: "Kathmandu Metropolitan City Library", category: "library", location: { lat: 27.7075, lng: 85.3140 }, description: "Bagbazar" },
  { name: "Nepal Academy Library", category: "library", location: { lat: 27.7115, lng: 85.3230 }, description: "Kamaladi" },
  { name: "Sano Library", category: "library", location: { lat: 27.6750, lng: 85.3110 }, description: "Jhamsikhel, children's library" },
  { name: "Bagmati Community Library", category: "library", location: { lat: 27.6935, lng: 85.3175 }, description: "Thapathali" },
  { name: "Godavari Community Library", category: "library", location: { lat: 27.5970, lng: 85.3900 }, description: "Godavari" },
  { name: "Balkumari Library", category: "library", location: { lat: 27.6660, lng: 85.3390 }, description: "Lalitpur" },
  { name: "Kirtipur Municipal Library", category: "library", location: { lat: 27.6770, lng: 85.2850 }, description: "Kirtipur" },

  // ---------------- GOVERNMENT_OFFICE ----------------
  { name: "Kathmandu Metropolitan City Office", category: "government_office", location: { lat: 27.7060, lng: 85.3125 }, description: "Bagdurbar" },
  { name: "Lalitpur Metropolitan City Office", category: "government_office", location: { lat: 27.6760, lng: 85.3195 }, description: "Pulchowk" },
  { name: "Bhaktapur Municipality Office", category: "government_office", location: { lat: 27.6715, lng: 85.4290 }, description: "Bhaktapur" },
  { name: "District Administration Office Kathmandu", category: "government_office", location: { lat: 27.6925, lng: 85.3255 }, description: "Babarmahal" },
  { name: "Department of Passport", category: "government_office", location: { lat: 27.7195, lng: 85.3140 }, description: "Narayanhiti Path" },
  { name: "Department of Transport Management", category: "government_office", location: { lat: 27.6635, lng: 85.3195 }, description: "Ekantakuna" },
  { name: "Ward Office 1 Kathmandu", category: "government_office", location: { lat: 27.7215, lng: 85.3070 }, description: "Kathmandu" },
  { name: "Ward Office 5 Lalitpur", category: "government_office", location: { lat: 27.6710, lng: 85.3180 }, description: "Lalitpur" },
  { name: "Ward Office 10 Bhaktapur", category: "government_office", location: { lat: 27.6730, lng: 85.4260 }, description: "Bhaktapur" },
  { name: "Inland Revenue Office", category: "government_office", location: { lat: 27.7175, lng: 85.3195 }, description: "Lazimpat" },
  { name: "Land Revenue Office", category: "government_office", location: { lat: 27.7095, lng: 85.3255 }, description: "Dillibazar" },
  { name: "Election Commission", category: "government_office", location: { lat: 27.7040, lng: 85.3235 }, description: "Kantipath" },
  { name: "Ministry of Home Affairs", category: "government_office", location: { lat: 27.6960, lng: 85.3260 }, description: "Singha Durbar" },
  { name: "Central Bureau of Statistics", category: "government_office", location: { lat: 27.7005, lng: 85.3200 }, description: "Ramshahpath" },
  { name: "Company Registrar Office", category: "government_office", location: { lat: 27.6935, lng: 85.3160 }, description: "Tripureshwor" },
  { name: "Kirtipur Municipality Office", category: "government_office", location: { lat: 27.6775, lng: 85.2845 }, description: "Kirtipur" },
  { name: "Madhyapur Thimi Municipality Office", category: "government_office", location: { lat: 27.6775, lng: 85.3960 }, description: "Thimi" },
  { name: "Tokha Municipality Office", category: "government_office", location: { lat: 27.7480, lng: 85.3320 }, description: "Tokha" },

  // ---------------- TRANSIT_STOP ----------------
  { name: "Ratna Park Bus Park", category: "transit_stop", location: { lat: 27.7050, lng: 85.3140 }, description: "Kathmandu" },
  { name: "City Bus Park Sorhakhutte", category: "transit_stop", location: { lat: 27.7145, lng: 85.3080 }, description: "Sorhakhutte" },
  { name: "Old Bus Park", category: "transit_stop", location: { lat: 27.7135, lng: 85.3100 }, description: "Kathmandu" },
  { name: "New Bus Park Gongabu", category: "transit_stop", location: { lat: 27.7300, lng: 85.3175 }, description: "Gongabu" },
  { name: "Lagankhel Bus Park", category: "transit_stop", location: { lat: 27.6660, lng: 85.3245 }, description: "Lalitpur" },
  { name: "Koteshwor Bus Stop", category: "transit_stop", location: { lat: 27.6780, lng: 85.3495 }, description: "Koteshwor" },
  { name: "Kalanki Bus Stop", category: "transit_stop", location: { lat: 27.6935, lng: 85.2810 }, description: "Kalanki" },
  { name: "Balaju Bus Stop", category: "transit_stop", location: { lat: 27.7295, lng: 85.3030 }, description: "Balaju" },
  { name: "Chabahil Bus Stop", category: "transit_stop", location: { lat: 27.7175, lng: 85.3470 }, description: "Chabahil" },
  { name: "New Baneshwor Bus Stop", category: "transit_stop", location: { lat: 27.6895, lng: 85.3395 }, description: "Baneshwor" },
  { name: "Jorpati Bus Stop", category: "transit_stop", location: { lat: 27.7365, lng: 85.3720 }, description: "Jorpati" },
  { name: "Sundhara Tempo Stand", category: "transit_stop", location: { lat: 27.7010, lng: 85.3130 }, description: "Sundhara" },
  { name: "Patan Dhoka Bus Stop", category: "transit_stop", location: { lat: 27.6790, lng: 85.3195 }, description: "Lalitpur" },
  { name: "Bhaktapur Bus Park", category: "transit_stop", location: { lat: 27.6705, lng: 85.4245 }, description: "Bhaktapur" },
  { name: "Suryabinayak Bus Stop", category: "transit_stop", location: { lat: 27.6635, lng: 85.4415 }, description: "Bhaktapur" },
  { name: "Satdobato Bus Stop", category: "transit_stop", location: { lat: 27.6595, lng: 85.3255 }, description: "Lalitpur" },
  { name: "Ekantakuna Bus Stop", category: "transit_stop", location: { lat: 27.6630, lng: 85.3190 }, description: "Lalitpur" },
  { name: "Maitighar Mandala Bus Stop", category: "transit_stop", location: { lat: 27.6935, lng: 85.3235 }, description: "Maitighar" },

  // ---------------- BANK_ATM ----------------
  { name: "Nepal Rastra Bank", category: "bank_atm", location: { lat: 27.7175, lng: 85.3310 }, description: "Baluwatar" },
  { name: "Nabil Bank Durbar Marg", category: "bank_atm", location: { lat: 27.7115, lng: 85.3175 }, description: "Durbar Marg" },
  { name: "NIC Asia Bank New Baneshwor", category: "bank_atm", location: { lat: 27.6900, lng: 85.3400 }, description: "New Baneshwor" },
  { name: "Global IME Bank Kamaladi", category: "bank_atm", location: { lat: 27.7075, lng: 85.3195 }, description: "Kamaladi" },
  { name: "Standard Chartered Bank Naxal", category: "bank_atm", location: { lat: 27.7130, lng: 85.3255 }, description: "Naxal" },
  { name: "Everest Bank New Baneshwor", category: "bank_atm", location: { lat: 27.6890, lng: 85.3410 }, description: "New Baneshwor" },
  { name: "Himalayan Bank Thamel", category: "bank_atm", location: { lat: 27.7155, lng: 85.3105 }, description: "Thamel" },
  { name: "Prabhu Bank Babarmahal", category: "bank_atm", location: { lat: 27.6935, lng: 85.3270 }, description: "Babarmahal" },
  { name: "NMB Bank Pulchowk", category: "bank_atm", location: { lat: 27.6755, lng: 85.3175 }, description: "Pulchowk" },
  { name: "Sanima Bank Nagpokhari", category: "bank_atm", location: { lat: 27.7150, lng: 85.3225 }, description: "Nagpokhari" },
  { name: "Machhapuchhre Bank Lazimpat", category: "bank_atm", location: { lat: 27.7185, lng: 85.3200 }, description: "Lazimpat" },
  { name: "Kumari Bank Putalisadak", category: "bank_atm", location: { lat: 27.7040, lng: 85.3230 }, description: "Putalisadak" },
  { name: "Siddhartha Bank Hattisar", category: "bank_atm", location: { lat: 27.7095, lng: 85.3260 }, description: "Hattisar" },
  { name: "Laxmi Bank Sundhara", category: "bank_atm", location: { lat: 27.7005, lng: 85.3120 }, description: "Sundhara" },
  { name: "Citizens Bank Kamalpokhari", category: "bank_atm", location: { lat: 27.7130, lng: 85.3270 }, description: "Kamalpokhari" },
  { name: "ATM Jawalakhel", category: "bank_atm", location: { lat: 27.6715, lng: 85.3130 }, description: "Jawalakhel" },
  { name: "ATM Bhaktapur Durbar Square", category: "bank_atm", location: { lat: 27.6720, lng: 85.4285 }, description: "Bhaktapur" },
  { name: "ATM Koteshwor", category: "bank_atm", location: { lat: 27.6775, lng: 85.3500 }, description: "Koteshwor" },

  // ---------------- PHARMACY ----------------
  { name: "Alka Hospital Pharmacy", category: "pharmacy", location: { lat: 27.6705, lng: 85.3135 }, description: "Jawalakhel" },
  { name: "Bhatbhateni Pharmacy Tinkune", category: "pharmacy", location: { lat: 27.6890, lng: 85.3465 }, description: "Tinkune" },
  { name: "Om Pharmacy Baneshwor", category: "pharmacy", location: { lat: 27.6905, lng: 85.3390 }, description: "Baneshwor" },
  { name: "Life Care Pharmacy Pulchowk", category: "pharmacy", location: { lat: 27.6760, lng: 85.3185 }, description: "Pulchowk" },
  { name: "City Pharmacy Thamel", category: "pharmacy", location: { lat: 27.7150, lng: 85.3110 }, description: "Thamel" },
  { name: "Green Cross Pharmacy Chabahil", category: "pharmacy", location: { lat: 27.7180, lng: 85.3455 }, description: "Chabahil" },
  { name: "Health Point Pharmacy Kalanki", category: "pharmacy", location: { lat: 27.6930, lng: 85.2820 }, description: "Kalanki" },
  { name: "Everest Pharmacy Koteshwor", category: "pharmacy", location: { lat: 27.6770, lng: 85.3510 }, description: "Koteshwor" },
  { name: "Grande Pharmacy Dhapasi", category: "pharmacy", location: { lat: 27.7360, lng: 85.3230 }, description: "Dhapasi" },
  { name: "Norvic Pharmacy Thapathali", category: "pharmacy", location: { lat: 27.6940, lng: 85.3170 }, description: "Thapathali" },
  { name: "Star Pharmacy Lagankhel", category: "pharmacy", location: { lat: 27.6655, lng: 85.3235 }, description: "Lagankhel" },
  { name: "Bir Hospital Pharmacy", category: "pharmacy", location: { lat: 27.7040, lng: 85.3125 }, description: "Mahaboudha" },
  { name: "Patan Pharmacy", category: "pharmacy", location: { lat: 27.6730, lng: 85.3250 }, description: "Mangal Bazar" },
  { name: "Civil Pharmacy Minbhawan", category: "pharmacy", location: { lat: 27.6975, lng: 85.3395 }, description: "Minbhawan" },
  { name: "B&B Pharmacy Gwarko", category: "pharmacy", location: { lat: 27.6690, lng: 85.3350 }, description: "Gwarko" },
  { name: "Sunrise Pharmacy Baluwatar", category: "pharmacy", location: { lat: 27.7195, lng: 85.3300 }, description: "Baluwatar" },
  { name: "Care Pharmacy Sanepa", category: "pharmacy", location: { lat: 27.6805, lng: 85.3075 }, description: "Sanepa" },

  // ---------------- PETROL_PUMP ----------------
  { name: "Sajha Petrol Pump Sundhara", category: "petrol_pump", location: { lat: 27.6995, lng: 85.3115 }, description: "Sundhara" },
  { name: "Annapurna Petroleum Balkhu", category: "petrol_pump", location: { lat: 27.6885, lng: 85.2955 }, description: "Balkhu" },
  { name: "Bagmati Petroleum Koteshwor", category: "petrol_pump", location: { lat: 27.6790, lng: 85.3480 }, description: "Koteshwor" },
  { name: "Nepal Oil Corporation Depot Teku", category: "petrol_pump", location: { lat: 27.6960, lng: 85.3060 }, description: "Teku" },
  { name: "Everest Fuel Center Gongabu", category: "petrol_pump", location: { lat: 27.7310, lng: 85.3190 }, description: "Gongabu" },
  { name: "Machhapuchhre Petrol Pump Kalanki", category: "petrol_pump", location: { lat: 27.6945, lng: 85.2800 }, description: "Kalanki" },
  { name: "Sitapaila Petrol Pump", category: "petrol_pump", location: { lat: 27.7130, lng: 85.2790 }, description: "Sitapaila" },
  { name: "Chabahil Petrol Pump", category: "petrol_pump", location: { lat: 27.7190, lng: 85.3450 }, description: "Chabahil" },
  { name: "Jadibuti Petrol Pump", category: "petrol_pump", location: { lat: 27.6835, lng: 85.3495 }, description: "Jadibuti" },
  { name: "Satdobato Petrol Pump", category: "petrol_pump", location: { lat: 27.6605, lng: 85.3265 }, description: "Lalitpur" },
  { name: "Thimi Petrol Pump", category: "petrol_pump", location: { lat: 27.6785, lng: 85.3945 }, description: "Bhaktapur" },
  { name: "Budhanilkantha Petrol Pump", category: "petrol_pump", location: { lat: 27.7850, lng: 85.3610 }, description: "Budhanilkantha" },
  { name: "Maharajgunj Petrol Pump", category: "petrol_pump", location: { lat: 27.7365, lng: 85.3325 }, description: "Maharajgunj" },
  { name: "Naikap Petrol Pump", category: "petrol_pump", location: { lat: 27.6970, lng: 85.2640 }, description: "Naikap" },
  { name: "Balaju Petrol Pump", category: "petrol_pump", location: { lat: 27.7280, lng: 85.3010 }, description: "Balaju" },
  { name: "Tokha Petrol Pump", category: "petrol_pump", location: { lat: 27.7470, lng: 85.3310 }, description: "Tokha" },

  // ---------------- POLICE_STATION ----------------
  { name: "Hanuman Dhoka Police Circle", category: "police_station", location: { lat: 27.7045, lng: 85.3080 }, description: "Kathmandu" },
  { name: "Metropolitan Police Circle Ranipokhari", category: "police_station", location: { lat: 27.7065, lng: 85.3145 }, description: "Ranipokhari" },
  { name: "Traffic Police Office Ratna Park", category: "police_station", location: { lat: 27.7055, lng: 85.3135 }, description: "Ratna Park" },
  { name: "Lalitpur District Police Office", category: "police_station", location: { lat: 27.6765, lng: 85.3190 }, description: "Pulchowk" },
  { name: "Bhaktapur District Police Office", category: "police_station", location: { lat: 27.6710, lng: 85.4275 }, description: "Bhaktapur" },
  { name: "Kirtipur Police Station", category: "police_station", location: { lat: 27.6785, lng: 85.2855 }, description: "Kirtipur" },
  { name: "Baneshwor Police Station", category: "police_station", location: { lat: 27.6910, lng: 85.3405 }, description: "Baneshwor" },
  { name: "Koteshwor Police Station", category: "police_station", location: { lat: 27.6775, lng: 85.3505 }, description: "Koteshwor" },
  { name: "Gongabu Police Station", category: "police_station", location: { lat: 27.7305, lng: 85.3185 }, description: "Gongabu" },
  { name: "Kalanki Police Station", category: "police_station", location: { lat: 27.6940, lng: 85.2815 }, description: "Kalanki" },
  { name: "Balaju Police Station", category: "police_station", location: { lat: 27.7290, lng: 85.3020 }, description: "Balaju" },
  { name: "Chabahil Police Station", category: "police_station", location: { lat: 27.7185, lng: 85.3460 }, description: "Chabahil" },
  { name: "Patan Police Circle", category: "police_station", location: { lat: 27.6735, lng: 85.3260 }, description: "Lalitpur" },
  { name: "Thimi Police Station", category: "police_station", location: { lat: 27.6780, lng: 85.3955 }, description: "Bhaktapur" },
  { name: "Maharajgunj Police Station", category: "police_station", location: { lat: 27.7370, lng: 85.3330 }, description: "Maharajgunj" },
  { name: "Naxal Police Station", category: "police_station", location: { lat: 27.7135, lng: 85.3260 }, description: "Naxal" },

  // ---------------- HOSPITAL ----------------
  { name: "Tribhuvan University Teaching Hospital", category: "hospital", location: { lat: 27.7365, lng: 85.3315 }, description: "Maharajgunj" },
  { name: "Bir Hospital", category: "hospital", location: { lat: 27.7038, lng: 85.3122 }, description: "Mahaboudha" },
  { name: "Patan Hospital", category: "hospital", location: { lat: 27.6660, lng: 85.3240 }, description: "Lagankhel" },
  { name: "Norvic International Hospital", category: "hospital", location: { lat: 27.6940, lng: 85.3175 }, description: "Thapathali" },
  { name: "Grande International Hospital", category: "hospital", location: { lat: 27.7365, lng: 85.3230 }, description: "Dhapasi" },
  { name: "Alka Hospital", category: "hospital", location: { lat: 27.6705, lng: 85.3130 }, description: "Jawalakhel" },
  { name: "Om Hospital", category: "hospital", location: { lat: 27.7180, lng: 85.3460 }, description: "Chabahil" },
  { name: "Nepal Mediciti", category: "hospital", location: { lat: 27.6440, lng: 85.3175 }, description: "Bhaisepati" },
  { name: "Kathmandu Medical College", category: "hospital", location: { lat: 27.7015, lng: 85.3505 }, description: "Sinamangal" },
  { name: "B&B Hospital", category: "hospital", location: { lat: 27.6690, lng: 85.3345 }, description: "Gwarko" },
  { name: "Civil Service Hospital", category: "hospital", location: { lat: 27.6975, lng: 85.3390 }, description: "Minbhawan" },
  { name: "Kanti Children's Hospital", category: "hospital", location: { lat: 27.7375, lng: 85.3300 }, description: "Maharajgunj" },
  { name: "Bhaktapur Hospital", category: "hospital", location: { lat: 27.6685, lng: 85.4180 }, description: "Bhaktapur" },
  { name: "Star Hospital", category: "hospital", location: { lat: 27.6810, lng: 85.3080 }, description: "Sanepa" },
  { name: "HAMS Hospital", category: "hospital", location: { lat: 27.7300, lng: 85.3380 }, description: "Dhumbarahi" },
  { name: "Nepal Police Hospital", category: "hospital", location: { lat: 27.7385, lng: 85.3320 }, description: "Maharajgunj" },
  { name: "Paropakar Maternity Hospital", category: "hospital", location: { lat: 27.6935, lng: 85.3155 }, description: "Thapathali" },

  // ---------------- TOURIST ----------------
  { name: "Nagarkot Viewpoint", category: "tourist", location: { lat: 27.7150, lng: 85.5210 }, description: "Sunrise viewpoint" },
  { name: "Chandragiri Hills Cable Car", category: "tourist", location: { lat: 27.6595, lng: 85.2385 }, description: "Cable car & viewpoint" },
  { name: "Shivapuri National Park", category: "tourist", location: { lat: 27.8100, lng: 85.3900 }, description: "National park entrance" },
  { name: "Godavari Botanical Garden", category: "tourist", location: { lat: 27.5965, lng: 85.3905 }, description: "Botanical garden" },
  { name: "Taudaha Lake", category: "tourist", location: { lat: 27.6595, lng: 85.2790 }, description: "Bird watching lake" },
  { name: "Balaju Water Garden", category: "tourist", location: { lat: 27.7315, lng: 85.3010 }, description: "22 stone spouts" },
  { name: "Kathmandu Fun Park", category: "tourist", location: { lat: 27.6935, lng: 85.3230 }, description: "Bhrikutimandap" },
  { name: "Phulchowki Hill", category: "tourist", location: { lat: 27.5965, lng: 85.3555 }, description: "Highest hill in valley rim" },
  { name: "Gokarna Forest Resort", category: "tourist", location: { lat: 27.7385, lng: 85.3855 }, description: "Gokarna" },
  { name: "Nagi Gompa", category: "tourist", location: { lat: 27.7860, lng: 85.3730 }, description: "Buddhist monastery" },
  { name: "Champadevi Hill", category: "tourist", location: { lat: 27.6550, lng: 85.2530 }, description: "Hiking viewpoint" },
  { name: "Sundarijal", category: "tourist", location: { lat: 27.7735, lng: 85.4230 }, description: "Waterfall & trailhead" },
  { name: "Dhulikhel Viewpoint", category: "tourist", location: { lat: 27.6210, lng: 85.5400 }, description: "Himalayan viewpoint" },
  { name: "Thankot Viewpoint", category: "tourist", location: { lat: 27.6935, lng: 85.2225 }, description: "Valley rim" },
  { name: "Jharuwarasi", category: "tourist", location: { lat: 27.6320, lng: 85.3230 }, description: "Riverside picnic spot" },

  // ---------------- SENSITIVE ----------------
  { name: "Singha Durbar", category: "sensitive", location: { lat: 27.6960, lng: 85.3265 }, description: "Central Secretariat" },
  { name: "Narayanhiti Palace Museum", category: "sensitive", location: { lat: 27.7175, lng: 85.3175 }, description: "Former royal palace" },
  { name: "Nepal Army Headquarters", category: "sensitive", location: { lat: 27.6975, lng: 85.3195 }, description: "Bhadrakali" },
  { name: "Nepal Police Headquarters", category: "sensitive", location: { lat: 27.7130, lng: 85.3255 }, description: "Naxal" },
  { name: "Armed Police Force Headquarters", category: "sensitive", location: { lat: 27.7300, lng: 85.2790 }, description: "Halchowk" },
  { name: "Tribhuvan International Airport", category: "sensitive", location: { lat: 27.6966, lng: 85.3591 }, description: "TIA" },
  { name: "Supreme Court", category: "sensitive", location: { lat: 27.7000, lng: 85.3195 }, description: "Ramshahpath" },
  { name: "Federal Parliament Building", category: "sensitive", location: { lat: 27.6920, lng: 85.3390 }, description: "New Baneshwor" },
  { name: "Central Jail Sundhara", category: "sensitive", location: { lat: 27.7000, lng: 85.3105 }, description: "Sundhara" },
  { name: "President's Office (Sheetal Niwas)", category: "sensitive", location: { lat: 27.7160, lng: 85.3195 }, description: "Maharajgunj Road" },
  { name: "Indian Embassy", category: "sensitive", location: { lat: 27.7175, lng: 85.3170 }, description: "Lainchaur" },
  { name: "Chinese Embassy", category: "sensitive", location: { lat: 27.7195, lng: 85.3305 }, description: "Baluwatar" },
  { name: "US Embassy", category: "sensitive", location: { lat: 27.7375, lng: 85.3305 }, description: "Maharajgunj" },
  { name: "Department of Immigration", category: "sensitive", location: { lat: 27.7085, lng: 85.3325 }, description: "Kalikasthan" },
  { name: "Military Headquarters Bhadrakali", category: "sensitive", location: { lat: 27.6980, lng: 85.3190 }, description: "Bhadrakali" },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Reuses whichever admin already exists — matches the pattern of
  // Place.addedBy (README §7) requiring an admin ObjectId. If you have
  // multiple admins, this just picks the first; swap for a specific
  // admin email lookup if you need a particular one attributed.
  const admin = await Admin.findOne();
  if (!admin) {
    console.error("No admin account found — seed an admin first (Place.addedBy requires one).");
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const p of PLACES) {
    // Upsert on name+category so re-running this script is safe and
    // idempotent — won't duplicate entries if you run it twice.
    const result = await Place.updateOne(
      { name: p.name, category: p.category },
      { $setOnInsert: { ...p, addedBy: admin._id } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) created++;
    else skipped++;
  }

  console.log(`Seed complete: ${created} places created, ${skipped} already existed.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});