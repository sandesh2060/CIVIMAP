// ========================================================================
// FILE : server/src/seed/posts.seed.js
// Seeds 100 Nepal-context civic feed posts across all six Post
// categories (announcement/road/traffic/safety/maintenance/other),
// bilingual EN+NE, with real photos.
// Run: node src/seed/posts.seed.js
//
// HOW CONTENT IS GENERATED: rather than hand-authoring 100 posts, this
// combines a small set of category-specific title/body templates with
// 30 real Kathmandu-valley + major-city locations, sampled without
// replacement per category so no two generated posts are identical.
// This is original generated text, not copied from any source.
//
// IMAGES: hotlinked directly from Wikimedia Commons via the stable
// Special:FilePath redirect (no Cloudinary upload — Post.imageUrl is a
// plain string field, confirmed against models/Post.js). Filenames were
// verified to exist on Commons before being used here. Fine for seed/
// demo data; for real production posts you'd still want the normal
// upload flow (uploadBuffer) so images live in your own Cloudinary.
//
// IDEMPOTENCY NOTE: unlike places.seed.js's upsert-on-{name,category},
// this upserts on title alone, and title generation is randomized per
// run (Fisher–Yates shuffle over template×location combos). Re-running
// this script will generally add a *second* batch of ~100 posts rather
// than being a true no-op — acceptable for seed/demo data, but flagging
// it since it diverges from the places.seed.js idempotency pattern.

const mongoose = require("mongoose");
require("dotenv").config();
const Post = require("../models/Post");
const Admin = require("../models/admin/Admin");

function filePath(commonsFilename) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsFilename)}`;
}

// Verified-existing Commons files, grouped by theme.
const IMAGES = {
  road: [
    filePath("Sinamangal road after rain.jpg"),
    filePath("Road Signs in Kathmandu.jpg"),
  ],
  traffic: [
    filePath("Traffic Police officer during Maha Shivaratri Celebrations near Jaya Bageshwori Road, Kathmandu, Nepal-070A6986.jpg"),
    filePath("Traffic-controllers - Kathmandu, Nepal - panoramio.jpg"),
    filePath("Transport Kathmandu 2013.JPG"),
  ],
  safety: [
    filePath("Rain runoff is chaneled into the sewer, muddy day, people step gingerly in open shoes, even the motorcycle riders drive carefully, Boudha streets, Kathmandu, Nepal (5365066198).jpg"),
    filePath("Sinamangal road after rain.jpg"),
  ],
  maintenance: [
    filePath("Rain runoff is chaneled into the sewer, muddy day, people step gingerly in open shoes, even the motorcycle riders drive carefully, Boudha streets, Kathmandu, Nepal (5365066198).jpg"),
    filePath("Walking the streets of Kathmandu, Nepal (25048259261).jpg"),
  ],
  announcement: [
    filePath("Kathmandu, Nepal.JPG"),
    filePath("Walking the streets of Kathmandu, Nepal (25048259261).jpg"),
  ],
  other: [
    filePath("Kathmandu, Nepal.JPG"),
    filePath("Transport Kathmandu 2013.JPG"),
  ],
};

// [English name, Nepali name]
const LOCATIONS = [
  ["Baneshwor", "बानेश्वर"], ["Koteshwor", "कोटेश्वर"], ["Kalanki", "कलंकी"],
  ["Balaju", "बालाजु"], ["Chabahil", "चाबहिल"], ["Gongabu", "गोंगबु"],
  ["Kirtipur", "कीर्तिपुर"], ["Thimi", "थिमी"], ["Patan", "पाटन"],
  ["Sundhara", "सुन्धारा"], ["Naxal", "नक्साल"], ["Maharajgunj", "महाराजगंज"],
  ["Jawalakhel", "जावलाखेल"], ["Sanepa", "सानेपा"], ["Pulchowk", "पुल्चोक"],
  ["Ring Road", "रिङरोड"], ["Ratna Park", "रत्नपार्क"], ["Ekantakuna", "एकान्तकुना"],
  ["Satdobato", "सातदोबाटो"], ["Gwarko", "ग्वारको"], ["Tokha", "टोखा"],
  ["Budhanilkantha", "बुढानीलकण्ठ"], ["Dhapasi", "ढापासी"], ["Pokhara", "पोखरा"],
  ["Biratnagar", "विराटनगर"], ["Butwal", "बुटवल"], ["Bharatpur", "भरतपुर"],
  ["Birgunj", "वीरगंज"], ["Nepalgunj", "नेपालगंज"], ["Dharan", "धरान"],
];

// Each template is a function of (locEn) -> {title, body} / (locNe) -> {title, body}
const TEMPLATES = {
  road: [
    {
      en: (l) => ({ title: `Deep Potholes Reported on ${l} Road`, body: `Commuters have flagged several deep potholes along the ${l} stretch, with some reporting damage to vehicle tyres and suspensions. Local residents are urging the Department of Roads to carry out repairs before the monsoon widens the damage further.` }),
      ne: (l) => ({ title: `${l} सडकमा गहिरो खाल्डाखुल्डी`, body: `${l} क्षेत्रको सडकमा धेरै गहिरो खाल्डाखुल्डी देखिएको छ, जसका कारण सवारी साधनका टायर र सस्पेन्सन बिग्रिएको गुनासो आइरहेको छ। स्थानीयवासीले वर्षायाम अघि नै सडक विभागलाई मर्मत गर्न आग्रह गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Blacktopping Completed on ${l} Stretch`, body: `The long-pending blacktopping work on the ${l} road section has been completed after months of dust and disruption. Commuters say the smoother surface has already eased travel time through the area.` }),
      ne: (l) => ({ title: `${l} खण्डमा कालोपत्रे कार्य सम्पन्न`, body: `लामो समयदेखि रोकिएको ${l} सडक खण्डको कालोपत्रे कार्य सम्पन्न भएको छ। यात्रुहरूका अनुसार अब सडक सहज भएकाले यात्रा गर्न सजिलो भएको छ।` }),
    },
    {
      en: (l) => ({ title: `Landslide Debris Blocks ${l} Road After Heavy Rain`, body: `Heavy overnight rain triggered a small landslide that blocked part of the road near ${l}, disrupting traffic through the morning. Municipal crews were dispatched to clear the debris.` }),
      ne: (l) => ({ title: `भारी वर्षापछि ${l} सडकमा पहिरोको मलबा`, body: `रातभरको भारी वर्षाका कारण ${l} नजिकको सडकको केही भाग पहिरोले थुनिएको छ, जसले बिहानभर ट्राफिकमा असर पुर्‍यायो। मलबा हटाउन नगरपालिकाको टोली खटिएको छ।` }),
    },
    {
      en: (l) => ({ title: `Road Widening Project Begins Near ${l}`, body: `Construction crews have started preliminary work on a road-widening project near ${l}, aimed at easing chronic congestion. Officials say the project will take several months and ask commuters to expect temporary diversions.` }),
      ne: (l) => ({ title: `${l} नजिक सडक विस्तार आयोजना सुरु`, body: `${l} नजिक दीर्घकालीन ट्राफिक जाम कम गर्न सडक विस्तार आयोजनाको प्रारम्भिक काम सुरु भएको छ। यो आयोजना केही महिना लाग्ने भएकाले यात्रुहरूलाई अस्थायी बाटो परिवर्तनको लागि तयार रहन आग्रह गरिएको छ।` }),
    },
    {
      en: (l) => ({ title: `Broken Drainage Cover Creates Hazard on ${l} Road`, body: `A missing drainage cover on the ${l} road has become a hazard for both pedestrians and two-wheelers, especially after dark. Residents have asked the ward office to fix or mark it urgently.` }),
      ne: (l) => ({ title: `${l} सडकमा भाँचिएको ढल छोप जोखिमपूर्ण`, body: `${l} सडकको ढल छोप हराएकाले पैदलयात्री र दुईपांग्रे सवारीका लागि विशेष गरी राति जोखिमपूर्ण भएको छ। स्थानीयवासीले वडा कार्यालयलाई तुरुन्त मर्मत वा चिन्ह लगाउन आग्रह गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Cracks Appear on Newly Paved ${l} Road`, body: `Just months after resurfacing, cracks have begun appearing along the ${l} road, raising questions among residents about the quality of the construction work.` }),
      ne: (l) => ({ title: `भर्खरै बनेको ${l} सडकमा चिरा देखिन थाल्यो`, body: `पुनःनिर्माण भएको केही महिनामै ${l} सडकमा चिरा देखिन थालेकाले निर्माण कार्यको गुणस्तरबारे स्थानीयवासीले प्रश्न उठाएका छन्।` }),
    },
    {
      en: (l) => ({ title: `Bridge Repair Works Announced for ${l}`, body: `Authorities have announced repair works for the aging bridge near ${l}, citing structural wear observed during a recent inspection. A temporary alternate route will be signposted during construction.` }),
      ne: (l) => ({ title: `${l} को पुल मर्मत कार्यको घोषणा`, body: `हालैको निरीक्षणमा संरचनागत जीर्णता देखिएपछि अधिकारीहरूले ${l} नजिकको पुरानो पुलको मर्मत कार्यको घोषणा गरेका छन्। निर्माण अवधिभर अस्थायी वैकल्पिक बाटो सूचित गरिनेछ।` }),
    },
  ],
  traffic: [
    {
      en: (l) => ({ title: `Traffic Congestion Worsens Near ${l} During Peak Hours`, body: `Commuters report growing congestion near ${l} during morning and evening peak hours, with average travel times noticeably longer over the past few weeks.` }),
      ne: (l) => ({ title: `${l} नजिक व्यस्त समयमा ट्राफिक जाम बढ्दो`, body: `बिहान र साँझको व्यस्त समयमा ${l} नजिक ट्राफिक जाम बढ्दै गएको यात्रुहरूले बताएका छन्। विगत केही हप्तायता यात्रा समय उल्लेख्य रूपमा बढेको छ।` }),
    },
    {
      en: (l) => ({ title: `New Traffic Signal Installed at ${l} Junction`, body: `A new traffic signal has been installed at the busy ${l} junction in an effort to reduce accidents and improve traffic flow. Traffic police say the signal will operate on a trial basis before final timing adjustments.` }),
      ne: (l) => ({ title: `${l} चोकमा नयाँ ट्राफिक बत्ती जडान`, body: `दुर्घटना कम गर्न र ट्राफिक प्रवाह सुधार्न व्यस्त ${l} चोकमा नयाँ ट्राफिक बत्ती जडान गरिएको छ। अन्तिम समय समायोजन गर्नुअघि यो प्रायोगिक आधारमा सञ्चालन हुने ट्राफिक प्रहरीले जनाएको छ।` }),
    },
    {
      en: (l) => ({ title: `Traffic Police Launch Helmet Enforcement Drive Near ${l}`, body: `Traffic police have launched a helmet and seatbelt enforcement drive near ${l}, issuing fines to riders and drivers found violating safety rules.` }),
      ne: (l) => ({ title: `${l} नजिक ट्राफिक प्रहरीको हेल्मेट परिचालन अभियान`, body: `${l} नजिक ट्राफिक प्रहरीले हेल्मेट र सिटबेल्ट लगाउने नियम उल्लंघन गर्नेलाई जरिवाना गर्दै परिचालन अभियान सुरु गरेको छ।` }),
    },
    {
      en: (l) => ({ title: `Zebra Crossing Repainted at ${l} Intersection`, body: `Faded zebra crossing markings at the ${l} intersection have been repainted following requests from local schools and pedestrians concerned about safety.` }),
      ne: (l) => ({ title: `${l} चोकमा जेब्रा क्रसिङ पुनः रङ्गाइयो`, body: `स्थानीय विद्यालय र पैदलयात्रुहरूको सुरक्षा चासोपछि ${l} चोकको फिक्का जेब्रा क्रसिङ पुनः रङ्गाइएको छ।` }),
    },
    {
      en: (l) => ({ title: `One-Way Rule Enforced on ${l} Road to Ease Congestion`, body: `Traffic authorities have begun enforcing a one-way rule on the narrow ${l} road in an attempt to reduce bottlenecks during peak hours.` }),
      ne: (l) => ({ title: `${l} सडकमा एकतर्फी नियम लागू`, body: `व्यस्त समयमा जाम कम गर्न साँघुरो ${l} सडकमा ट्राफिक अधिकारीहरूले एकतर्फी नियम लागू गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Diversion in Place Near ${l} Due to Road Maintenance`, body: `A temporary traffic diversion is in effect near ${l} while maintenance crews carry out repair work. Commuters are advised to plan for extra travel time.` }),
      ne: (l) => ({ title: `${l} नजिक मर्मत कार्यका कारण बाटो परिवर्तन`, body: `मर्मत कार्य भइरहेको कारण ${l} नजिक अस्थायी बाटो परिवर्तन लागू भएको छ। यात्रुहरूलाई अतिरिक्त समय लिएर यात्रा गर्न सुझाव दिइएको छ।` }),
    },
  ],
  safety: [
    {
      en: (l) => ({ title: `Monsoon Safety Advisory Issued for ${l} Residents`, body: `Local authorities have issued a monsoon safety advisory for residents near ${l}, urging caution around waterlogged streets and unstable riverbanks during heavy rainfall.` }),
      ne: (l) => ({ title: `${l} वासीका लागि मनसुन सुरक्षा सूचना`, body: `भारी वर्षाका बेला पानी जम्ने सडक र कमजोर नदी किनारमा सावधानी अपनाउन ${l} नजिकका बासिन्दालाई स्थानीय अधिकारीले मनसुन सुरक्षा सूचना जारी गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Earthquake Preparedness Drill Held in ${l}`, body: `An earthquake preparedness drill was conducted in ${l} this week, with volunteers and ward staff practicing evacuation routes and first-response procedures.` }),
      ne: (l) => ({ title: `${l} मा भूकम्प पूर्वतयारी अभ्यास`, body: `यस हप्ता ${l} मा भूकम्प पूर्वतयारी अभ्यास सञ्चालन गरियो, जसमा स्वयंसेवक र वडा कर्मचारीहरूले उद्धार मार्ग र प्रारम्भिक प्रतिक्रिया प्रक्रियाको अभ्यास गरे।` }),
    },
    {
      en: (l) => ({ title: `Fire Safety Awareness Campaign Reaches ${l}`, body: `A fire safety awareness campaign visited ${l} this week, distributing pamphlets and demonstrating basic fire extinguisher use to shopkeepers and residents.` }),
      ne: (l) => ({ title: `${l} मा अग्निसुरक्षा सचेतना अभियान`, body: `यस हप्ता ${l} मा अग्निसुरक्षा सचेतना अभियान पुगेको छ, जसले पर्चा वितरण र पसले तथा बासिन्दाहरूलाई प्रारम्भिक अग्निशामक प्रयोगको प्रदर्शन गर्‍यो।` }),
    },
    {
      en: (l) => ({ title: `Road Safety Week Observed Near ${l}`, body: `Road Safety Week events were held near ${l}, including awareness rallies and a school program encouraging students to follow traffic rules.` }),
      ne: (l) => ({ title: `${l} नजिक सडक सुरक्षा सप्ताह मनाइयो`, body: `${l} नजिक सडक सुरक्षा सप्ताहका कार्यक्रमहरू भए, जसमा सचेतना र्‍याली र विद्यार्थीहरूलाई ट्राफिक नियम पालना गर्न प्रोत्साहित गर्ने विद्यालय कार्यक्रम समावेश थियो।` }),
    },
    {
      en: (l) => ({ title: `Flood Warning Issued for Areas Near ${l}`, body: `A flood warning has been issued for low-lying areas near ${l} following days of continuous rainfall. Residents in vulnerable zones are advised to stay alert.` }),
      ne: (l) => ({ title: `${l} नजिकका क्षेत्रमा बाढी चेतावनी`, body: `लगातार वर्षापछि ${l} नजिकका होचो क्षेत्रहरूमा बाढी चेतावनी जारी गरिएको छ। जोखिमपूर्ण क्षेत्रका बासिन्दालाई सतर्क रहन सुझाव दिइएको छ।` }),
    },
    {
      en: (l) => ({ title: `Public Urged to Avoid ${l} Underpass During Heavy Rain`, body: `Ward officials are urging commuters to avoid the ${l} underpass during heavy rainfall, after it repeatedly flooded during recent storms.` }),
      ne: (l) => ({ title: `भारी वर्षाका बेला ${l} अन्डरपास नजिकनजाने आग्रह`, body: `हालैका वर्षामा पटक-पटक डुबेको ${l} अन्डरपासमा भारी वर्षाका बेला नजान वडा अधिकारीहरूले यात्रुहरूलाई आग्रह गरेका छन्।` }),
    },
  ],
  maintenance: [
    {
      en: (l) => ({ title: `Streetlights Restored Along ${l} Road`, body: `Streetlights that had been out for weeks along the ${l} road have been repaired, improving visibility and safety for evening commuters.` }),
      ne: (l) => ({ title: `${l} सडकमा सडक बत्ती पुनर्स्थापना`, body: `हप्तौंदेखि बलेको नभएको ${l} सडकको बत्ती मर्मत गरिएको छ, जसले साँझको यात्रुहरूका लागि दृश्यता र सुरक्षा सुधारेको छ।` }),
    },
    {
      en: (l) => ({ title: `Garbage Collection Resumes in ${l} After Delay`, body: `Regular garbage collection has resumed in ${l} after a brief service delay left waste piling up on street corners, drawing complaints from residents.` }),
      ne: (l) => ({ title: `${l} मा ढिलाइपछि फोहोर संकलन पुनः सुरु`, body: `छोटो सेवा ढिलाइपछि ${l} मा नियमित फोहोर संकलन पुनः सुरु भएको छ, जुन ढिलाइका कारण सडक कुनाहरूमा फोहोर थुप्रिएर बासिन्दाहरूको गुनासो आएको थियो।` }),
    },
    {
      en: (l) => ({ title: `Water Supply Restored in ${l} Following Pipeline Repair`, body: `Water supply has been restored to households in ${l} after crews completed repairs on a damaged pipeline that had disrupted service for several days.` }),
      ne: (l) => ({ title: `पाइपलाइन मर्मतपछि ${l} मा पानी आपूर्ति पुनर्स्थापना`, body: `केही दिनसम्म सेवामा अवरोध पुर्‍याएको क्षतिग्रस्त पाइपलाइनको मर्मत सम्पन्न भएपछि ${l} का घरधुरीहरूमा पानी आपूर्ति पुनर्स्थापना भएको छ।` }),
    },
    {
      en: (l) => ({ title: `Drainage Cleaning Drive Conducted in ${l}`, body: `A municipal drainage cleaning drive was carried out in ${l} ahead of the monsoon, aimed at preventing waterlogging in low-lying stretches.` }),
      ne: (l) => ({ title: `${l} मा ढल सफाइ अभियान सञ्चालन`, body: `मनसुन अघि होचो क्षेत्रहरूमा पानी जम्ने समस्या रोक्न ${l} मा नगरपालिकाको ढल सफाइ अभियान सञ्चालन गरियो।` }),
    },
    {
      en: (l) => ({ title: `Damaged Footpath Repaired Near ${l}`, body: `A long-damaged footpath section near ${l} has finally been repaired, making the route safer for pedestrians and schoolchildren.` }),
      ne: (l) => ({ title: `${l} नजिकको क्षतिग्रस्त पैदलमार्ग मर्मत`, body: `लामो समयदेखि क्षतिग्रस्त रहेको ${l} नजिकको पैदलमार्ग अन्ततः मर्मत गरिएको छ, जसले पैदलयात्री र विद्यार्थीका लागि बाटो सुरक्षित बनाएको छ।` }),
    },
    {
      en: (l) => ({ title: `Overflowing Waste Bins Cleared From ${l}`, body: `Overflowing public waste bins near ${l} have been cleared following complaints from nearby shopkeepers about odor and pest concerns.` }),
      ne: (l) => ({ title: `${l} बाट भरिएका फोहोर धुर्रा सफा`, body: `गन्ध र किरा-कीराको समस्याबारे नजिकैका पसलेहरूको गुनासोपछि ${l} नजिकका भरिएका सार्वजनिक फोहोर धुर्राहरू सफा गरिएका छन्।` }),
    },
  ],
  announcement: [
    {
      en: (l) => ({ title: `Free Health Checkup Camp at ${l} Ward Office`, body: `A free health checkup camp will be held at the ${l} ward office this week, offering basic screenings and consultations for local residents.` }),
      ne: (l) => ({ title: `${l} वडा कार्यालयमा निःशुल्क स्वास्थ्य शिविर`, body: `यस हप्ता ${l} वडा कार्यालयमा निःशुल्क स्वास्थ्य जाँच शिविर आयोजना हुनेछ, जसमा स्थानीयवासीका लागि आधारभूत जाँच र परामर्श उपलब्ध हुनेछ।` }),
    },
    {
      en: (l) => ({ title: `Blood Donation Program Scheduled in ${l}`, body: `A community blood donation program is scheduled in ${l} this weekend, organized in partnership with the local Red Cross chapter.` }),
      ne: (l) => ({ title: `${l} मा रक्तदान कार्यक्रम`, body: `यस साता ${l} मा स्थानीय रेडक्रस शाखासँगको सहकार्यमा सामुदायिक रक्तदान कार्यक्रम आयोजना हुनेछ।` }),
    },
    {
      en: (l) => ({ title: `Public Notice: Water Tanker Schedule for ${l} This Week`, body: `The municipality has released this week's water tanker delivery schedule for ${l} to help residents plan around ongoing supply disruptions.` }),
      ne: (l) => ({ title: `सार्वजनिक सूचना: ${l} को पानी ट्याङ्कर तालिका`, body: `पानी आपूर्तिमा भइरहेको अवरोधका बीच बासिन्दालाई सहज बनाउन नगरपालिकाले ${l} को यस हप्ताको पानी ट्याङ्कर वितरण तालिका सार्वजनिक गरेको छ।` }),
    },
    {
      en: (l) => ({ title: `Vaccination Drive Announced for ${l} Residents`, body: `A vaccination drive has been announced for residents in ${l}, with mobile health teams expected to visit the area over the coming days.` }),
      ne: (l) => ({ title: `${l} वासीका लागि खोप अभियान घोषणा`, body: `${l} का बासिन्दाका लागि खोप अभियानको घोषणा गरिएको छ, आगामी दिनहरूमा मोबाइल स्वास्थ्य टोली उक्त क्षेत्रमा पुग्ने अपेक्षा गरिएको छ।` }),
    },
    {
      en: (l) => ({ title: `Ward Office in ${l} to Remain Closed for Public Holiday`, body: `The ward office serving ${l} will remain closed for the upcoming public holiday. Residents are advised to complete urgent paperwork beforehand.` }),
      ne: (l) => ({ title: `सार्वजनिक बिदाका कारण ${l} वडा कार्यालय बन्द रहने`, body: `आगामी सार्वजनिक बिदाका कारण ${l} क्षेत्र सेवा दिने वडा कार्यालय बन्द रहनेछ। बासिन्दालाई आवश्यक कागजी काम पहिले नै सम्पन्न गर्न सुझाव दिइएको छ।` }),
    },
    {
      en: (l) => ({ title: `Community Cleanup Campaign Planned in ${l}`, body: `A volunteer-led community cleanup campaign is planned in ${l} this month, with organizers calling on residents to join and help keep public spaces litter-free.` }),
      ne: (l) => ({ title: `${l} मा सामुदायिक सरसफाइ अभियानको योजना`, body: `यस महिना ${l} मा स्वयंसेवकको नेतृत्वमा सामुदायिक सरसफाइ अभियानको योजना बनाइएको छ, आयोजकहरूले बासिन्दालाई सार्वजनिक स्थलहरू सफा राख्न सहभागी हुन आह्वान गरेका छन्।` }),
    },
    {
      en: () => ({ title: `Together for a Better Nepal`, body: `Every responsible action contributes to a stronger Nepal. Let's protect public property, support our communities, and work together for sustainable development.` }),
      ne: () => ({ title: `समृद्ध नेपालका लागि सँगै`, body: `हरेक जिम्मेवार कार्यले बलियो नेपाल निर्माणमा योगदान पुर्‍याउँछ। आउनुहोस्, सार्वजनिक सम्पत्तिको संरक्षण गरौं, हाम्रो समुदायलाई साथ दिऔं, र दिगो विकासका लागि सँगै काम गरौं।` }),
    },
  ],
  other: [
    {
      en: (l) => ({ title: `Local Market Vendors Report Overcrowding Near ${l}`, body: `Street vendors near ${l} say worsening overcrowding is affecting foot traffic and safety, and have asked the ward office to consider better space management.` }),
      ne: (l) => ({ title: `${l} नजिक बजार बिक्रेताहरूको भीडभाडको गुनासो`, body: `${l} नजिकका सडक बिक्रेताहरूले बढ्दो भीडभाडले पैदल आवतजावत र सुरक्षामा असर पारेको बताउँदै वडा कार्यालयलाई राम्रो स्थान व्यवस्थापनको लागि आग्रह गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Stray Dog Population Rising Concern in ${l}`, body: `Residents of ${l} have raised concerns over a growing stray dog population in the area, calling for a coordinated sterilization and vaccination program.` }),
      ne: (l) => ({ title: `${l} मा फुर्सदे कुकुरको संख्या बढ्दो चिन्ता`, body: `${l} का बासिन्दाले क्षेत्रमा बढ्दो फुर्सदे कुकुरको संख्याप्रति चिन्ता व्यक्त गर्दै समन्वयात्मक बन्ध्याकरण र खोप कार्यक्रमको माग गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Residents of ${l} Raise Concern Over Illegal Construction`, body: `Residents near ${l} have flagged what they describe as unauthorized construction encroaching on a public right-of-way, and have asked municipal authorities to investigate.` }),
      ne: (l) => ({ title: `${l} वासीको अवैध निर्माणप्रति चिन्ता`, body: `${l} नजिकका बासिन्दाले सार्वजनिक बाटोमा अतिक्रमण गर्ने खालको अनधिकृत निर्माण भएको बताउँदै नगरपालिका अधिकारीलाई अनुसन्धान गर्न आग्रह गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Public Park Renovation Proposed for ${l}`, body: `Local officials have proposed a renovation plan for the public park in ${l}, which has fallen into disrepair over recent years.` }),
      ne: (l) => ({ title: `${l} को सार्वजनिक पार्क नवीकरणको प्रस्ताव`, body: `विगत केही वर्षमा जीर्ण बन्दै गएको ${l} को सार्वजनिक पार्कको नवीकरण योजना स्थानीय अधिकारीहरूले प्रस्ताव गरेका छन्।` }),
    },
    {
      en: (l) => ({ title: `Noise Pollution Complaints Increase Near ${l}`, body: `Residents near ${l} report a rise in noise complaints linked to late-night construction and loud vehicle horns, and are asking for stricter enforcement of existing rules.` }),
      ne: (l) => ({ title: `${l} नजिक ध्वनि प्रदूषणको गुनासो बढ्दो`, body: `${l} नजिकका बासिन्दाले रातिको निर्माण कार्य र चर्को हर्नका कारण ध्वनि प्रदूषणको गुनासो बढेको बताउँदै विद्यमान नियमको कडाइका साथ कार्यान्वयन गर्न आग्रह गरेका छन्।` }),
    },
  ],
};

const CATEGORY_COUNTS = {
  road: 22,
  traffic: 18,
  safety: 15,
  maintenance: 15,
  announcement: 20,
  other: 10,
}; // sums to 100

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPastDate(maxDaysAgo) {
  const now = Date.now();
  const offsetMs = randomInt(0, maxDaysAgo) * 24 * 60 * 60 * 1000;
  return new Date(now - offsetMs);
}

function buildPosts() {
  const posts = [];
  let pinnedAssigned = 0;

  for (const [category, count] of Object.entries(CATEGORY_COUNTS)) {
    const templates = TEMPLATES[category];
    const combos = [];
    for (const loc of LOCATIONS) {
      for (const tpl of templates) combos.push({ loc, tpl });
    }
    shuffle(combos);

    for (let i = 0; i < count; i++) {
      const { loc, tpl } = combos[i % combos.length];
      const [locEn, locNe] = loc;
      const { title, body } = tpl.en(locEn);
      const { title: titleNe, body: bodyNe } = tpl.ne(locNe);
      const images = IMAGES[category];
      const imageUrl = images[i % images.length];
      const publishedAt = randomPastDate(60); // spread over the last ~2 months

      posts.push({
        title,
        titleNe,
        body,
        bodyNe,
        category,
        imageUrl,
        status: "published",
        publishedAt,
        isPinned: pinnedAssigned < 2 && Math.random() < 0.05 ? (pinnedAssigned++, true) : false,
        likeCount: randomInt(0, 40),
        commentCount: 0, // left at 0 — Comment docs aren't seeded here, so this stays consistent
        viewCount: randomInt(0, 300),
      });
    }
  }

  return posts;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Post.createdBy is a required ref to Admin (see models/Post.js) — same
  // "reuse whichever admin exists" pattern as places.seed.js.
  const admin = await Admin.findOne();
  if (!admin) {
    console.error("No admin account found — run admin.seed.js first (Post.createdBy requires one).");
    process.exit(1);
  }

  const posts = buildPosts();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of posts) {
    const doc = { ...p, createdBy: admin._id };

    try {
      // Upsert on title alone (see idempotency note at top of file — this
      // is a weaker guarantee than places.seed.js's {name,category} key,
      // since titles here are randomly generated per run).
      const result = await Post.updateOne(
        { title: p.title },
        { $setOnInsert: doc },
        { upsert: true, runValidators: true }
      );
      if (result.upsertedCount > 0) created++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error(`Failed to seed "${p.title}":`, err.message);
    }
  }

  console.log(`Seed complete: ${created} created, ${skipped} already existed, ${failed} failed. Total attempted: ${posts.length}.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});