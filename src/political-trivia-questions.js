// Curated factual trivia. Every base fact becomes two differently worded prompts.
// Source notes are included for maintenance; verify country-specific facts before editing.
const facts = [];
const add = (category, question, alternate, answers, source) => facts.push({ category, question, alternate, answers: Array.isArray(answers) ? answers : [answers], source });

const capitals = [
['Afghanistan','Kabul'],['Albania','Tirana'],['Algeria','Algiers'],['Andorra','Andorra la Vella'],['Angola','Luanda'],
['Argentina','Buenos Aires'],['Armenia','Yerevan'],['Australia','Canberra'],['Austria','Vienna'],['Azerbaijan','Baku'],
['Bahamas','Nassau'],['Bahrain','Manama'],['Bangladesh','Dhaka'],['Barbados','Bridgetown'],['Belarus','Minsk'],
['Belgium','Brussels'],['Belize','Belmopan'],['Benin','Porto-Novo'],['Bhutan','Thimphu'],['Bolivia','Sucre'],
['Bosnia and Herzegovina','Sarajevo'],['Botswana','Gaborone'],['Brazil','Brasilia'],['Brunei','Bandar Seri Begawan'],['Bulgaria','Sofia'],
['Cambodia','Phnom Penh'],['Cameroon','Yaounde'],['Canada','Ottawa'],['Chile','Santiago'],['China','Beijing'],
['Colombia','Bogota'],['Costa Rica','San Jose'],['Croatia','Zagreb'],['Cuba','Havana'],['Cyprus','Nicosia'],
['Czechia','Prague'],['Denmark','Copenhagen'],['Djibouti','Djibouti'],['Dominican Republic','Santo Domingo'],['Ecuador','Quito'],
['Egypt','Cairo'],['El Salvador','San Salvador'],['Estonia','Tallinn'],['Ethiopia','Addis Ababa'],['Fiji','Suva'],
['Finland','Helsinki'],['France','Paris'],['Georgia','Tbilisi'],['Germany','Berlin'],['Ghana','Accra'],
['Greece','Athens'],['Guatemala','Guatemala City'],['Honduras','Tegucigalpa'],['Hungary','Budapest'],['Iceland','Reykjavik'],
['India','New Delhi'],['Indonesia','Jakarta'],['Iran','Tehran'],['Iraq','Baghdad'],['Ireland','Dublin'],
['Israel','Jerusalem'],['Italy','Rome'],['Jamaica','Kingston'],['Japan','Tokyo'],['Jordan','Amman'],
['Kazakhstan','Astana'],['Kenya','Nairobi'],['Kuwait','Kuwait City'],['Kyrgyzstan','Bishkek'],['Laos','Vientiane'],
['Latvia','Riga'],['Lebanon','Beirut'],['Libya','Tripoli'],['Liechtenstein','Vaduz'],['Lithuania','Vilnius'],
['Luxembourg','Luxembourg'],['Madagascar','Antananarivo'],['Malaysia','Kuala Lumpur'],['Maldives','Male'],['Mali','Bamako'],
['Malta','Valletta'],['Mexico','Mexico City'],['Moldova','Chisinau'],['Monaco','Monaco'],['Mongolia','Ulaanbaatar'],
['Montenegro','Podgorica'],['Morocco','Rabat'],['Mozambique','Maputo'],['Myanmar','Naypyidaw'],['Namibia','Windhoek'],
['Nepal','Kathmandu'],['Netherlands','Amsterdam'],['New Zealand','Wellington'],['Nicaragua','Managua'],['Nigeria','Abuja'],
['North Korea','Pyongyang'],['North Macedonia','Skopje'],['Norway','Oslo'],['Oman','Muscat'],['Pakistan','Islamabad']
];
for (const [country, capital] of capitals) {
  add('Flags and capitals', 'What is the capital city of ' + country + '?', 'Which city serves as the capital of ' + country + '?', [capital], 'CIA World Factbook; national government references. Some states have multiple or disputed capital arrangements.');
}

const geography = [
['What is the largest ocean on Earth?','Which ocean covers the greatest area?','Pacific Ocean'],
['Which is the smallest continent by land area in the usual seven-continent model?','What is the smallest of the seven continents?','Australia'],
['What is the longest river in South America?','Which river is generally recognized as South America’s longest?','Amazon River'],
['Which mountain range traditionally marks part of the boundary between Europe and Asia?','What mountain range forms part of the conventional Europe–Asia boundary?','Ural Mountains'],
['What is the world’s largest hot desert?','Which hot desert is the largest on Earth?','Sahara Desert'],
['Which country contains most of the Amazon rainforest?','Most of the Amazon rainforest lies in which country?','Brazil'],
['What is the highest mountain above sea level?','Which mountain has the highest summit above sea level?','Mount Everest'],
['Which sea lies between northeast Africa and the Arabian Peninsula?','What sea separates northeast Africa from the Arabian Peninsula?','Red Sea'],
['Which strait connects the Persian Gulf with the Gulf of Oman?','Through which strait do ships leave the Persian Gulf for the Gulf of Oman?','Strait of Hormuz'],
['Which African lake is commonly cited as the source region of the White Nile?','Which great lake is associated with the White Nile’s source region?','Lake Victoria'],
['What is the largest island in the world that is not a continent?','Which is the world’s largest non-continental island?','Greenland'],
['Which river flows through Paris?','What river passes through Paris?','Seine'],
['Which river flows through Baghdad?','What major river runs through Baghdad?','Tigris'],
['Which plateau is often called the Roof of the World?','What high plateau is known as the Roof of the World?','Tibetan Plateau'],
['What is the deepest known ocean trench?','Which ocean trench reaches the greatest known depth?','Mariana Trench'],
['Which continent has the greatest number of countries?','Which continent is generally counted as having the most sovereign states?','Africa'],
['Which ocean lies between Africa and Australia?','What ocean separates Africa from Australia?','Indian Ocean'],
['What is the largest lake by surface area?','Which lake has the greatest surface area in the world?','Caspian Sea'],
['Which river forms much of the border between the United States and Mexico?','Which river marks a large part of the US–Mexico boundary?','Rio Grande'],
['Which country is home to the Atacama Desert?','In which country is most of the Atacama Desert located?','Chile'],
['Which African country is completely surrounded by South Africa?','Which independent country is an enclave within South Africa?','Lesotho'],
['Which two countries share the island of Hispaniola?','Name the two countries on Hispaniola.','Haiti and Dominican Republic'],
['Which country has coastlines on both the Atlantic and Indian Oceans in southern Africa?','Which southern African country borders both the Atlantic and Indian Oceans?','South Africa'],
['What is the largest country in the world by area?','Which country covers the greatest total area?','Russia'],
['Which European river flows through Vienna, Bratislava, Budapest and Belgrade?','Which major river passes through four of those European capitals?','Danube'],
['Which country is known for the fjords along its western coast?','Which Scandinavian country is especially known for its western fjords?','Norway'],
['Which desert stretches across parts of Mongolia and northern China?','What desert lies across Mongolia and northern China?','Gobi Desert'],
['Which sea is bordered by countries including Turkey, Bulgaria and Ukraine?','What sea lies between southeastern Europe and western Asia and borders Ukraine?','Black Sea'],
['Which country is both in Europe and Asia and has Istanbul on both sides of the Bosporus?','Which transcontinental country includes Istanbul?','Turkey'],
['Which river flows through London?','What river runs through London?','Thames']
];
for (const [q, alt, answer] of geography) add('Geography', q, alt, answer, 'National geographic agencies; Encyclopaedia Britannica geography references.');

const history = [
['In which year did the Berlin Wall fall?','When did the Berlin Wall open and begin to fall?','1989'],
['In which year did the United Nations officially come into existence?','What year marks the founding of the UN?','1945'],
['Which ancient civilization built the pyramids at Giza?','Who built the Giza pyramids in ancient times?','Ancient Egyptians'],
['In which year did World War II end?','What year did the Second World War end?','1945'],
['Which city was buried by the eruption of Mount Vesuvius in AD 79?','What Roman-era city was buried by Vesuvius in AD 79?','Pompeii'],
['Which empire built the Colosseum in Rome?','The Colosseum was built under which ancient empire?','Roman Empire'],
['Which document signed in 1215 limited the English king’s power?','What 1215 charter is famous for limiting royal authority in England?','Magna Carta'],
['Who was the first person to walk on the Moon?','Who made the first human Moonwalk in 1969?','Neil Armstrong'],
['In which year did India gain independence from British rule?','What year did India become independent from Britain?','1947'],
['Which ship carried the Pilgrims to North America in 1620?','What was the name of the Pilgrims’ 1620 ship?','Mayflower'],
['Which French leader was defeated at Waterloo in 1815?','Who was the French emperor defeated at Waterloo?','Napoleon Bonaparte'],
['Which ancient Greek city-state is associated with the birth of democracy?','Which Greek city-state developed an early form of democracy?','Athens'],
['In which year did the French Revolution begin?','What year marks the start of the French Revolution?','1789'],
['Which trade route historically connected China with regions to its west?','What network of routes linked China with western regions for centuries?','Silk Road'],
['Which civilization developed cuneiform writing in ancient Mesopotamia?','Who used one of the earliest known writing systems, cuneiform?','Sumerians'],
['Which queen ruled Egypt and allied with Julius Caesar and Mark Antony?','Which Ptolemaic Egyptian ruler was associated with Caesar and Antony?','Cleopatra VII'],
['Which city was the capital of the Byzantine Empire?','What city served as the Byzantine Empire’s capital?','Constantinople'],
['In which year did the Soviet Union dissolve?','What year did the USSR cease to exist?','1991'],
['Which South African leader became president in 1994 after apartheid?','Who became South Africa’s president in 1994 after the end of apartheid?','Nelson Mandela'],
['Which war was fought between the North and South in the United States from 1861 to 1865?','What US conflict took place from 1861 to 1865?','American Civil War'],
['Which civilization built Machu Picchu?','Machu Picchu is associated with which Andean civilization?','Inca'],
['Which city was the main center of the Renaissance in Tuscany?','Which Tuscan city became a major Renaissance center?','Florence'],
['Who was the first woman to win a Nobel Prize?','Which scientist and pioneer was the first woman Nobel laureate?','Marie Curie'],
['Which treaty formally ended the state of war between Germany and the Allied Powers after World War I?','What 1919 treaty imposed peace terms on Germany after World War I?','Treaty of Versailles'],
['Which empire was ruled from Tenochtitlan before the Spanish conquest?','Tenochtitlan was the capital of which Mesoamerican empire?','Aztec Empire'],
['Which ancient wonder stood at the harbor of Alexandria?','What famous ancient wonder was located in Alexandria, Egypt?','Lighthouse of Alexandria'],
['Which 1776 document declared the thirteen American colonies independent from Britain?','What document announced US independence in 1776?','United States Declaration of Independence'],
['Which empire’s capital was Tenochtitlan?','Which empire had its capital at Tenochtitlan?','Aztec Empire'],
['Which pandemic devastated Europe in the mid-14th century and is also called the Black Death?','What major 14th-century pandemic is known as the Black Death?','Black Death'],
['Which 1989 protests and political changes led to the end of communist rule in Czechoslovakia, known as the Velvet Revolution?','What was the peaceful 1989 revolution in Czechoslovakia called?','Velvet Revolution']
];
for (const [q, alt, answer] of history) add('History', q, alt, answer, 'UN historical records; national archives; museum and university history references.');

const politics = [
['What is the term for a system in which citizens elect representatives to make laws?','What political system uses elected representatives to govern?','Representative democracy'],
['What is the name for a formal change to a constitution?','What is an official constitutional change called?','Amendment'],
['What is the principle that government powers are divided among branches called?','What principle separates executive, legislative and judicial powers?','Separation of powers'],
['What is a legislature with two chambers called?','What term describes a parliament with two houses?','Bicameral legislature'],
['What is the minimum age or other condition required to vote called?','What term describes the legal requirements to vote?','Voting eligibility'],
['What is a direct public vote on a specific question called?','What is a public vote on a particular proposal called?','Referendum'],
['What is the official record of votes cast in a legislature called?','What record shows how legislators voted?','Roll-call vote'],
['What is the term for a government led by a prime minister and cabinet responsible to parliament?','What system makes the executive accountable to parliament?','Parliamentary system'],
['What is the process of formally accusing a public official of misconduct called in some systems?','What is the formal legislative accusation of certain officials called?','Impeachment'],
['What is the principle that everyone, including leaders, is subject to the law?','What principle requires rulers and citizens alike to obey the law?','Rule of law'],
['What is the term for an area represented by an elected legislator?','What is an electoral area represented by a legislator called?','Constituency'],
['What is the formal process of choosing a candidate or option by voting called?','What is the act of selecting leaders through votes called?','Election'],
['What is a government formed by multiple political parties called?','What do you call a government whose parties share power?','Coalition government'],
['What is the term for the party or group that challenges the governing party in parliament?','What is the group that scrutinizes the government from outside it called?','Opposition'],
['What is the right to express opinions without government censorship commonly called?','What civil liberty protects expressing views?','Freedom of speech'],
['What is a government’s yearly plan for revenue and spending called?','What is the annual public revenue-and-expenditure plan called?','Budget'],
['What is the process of reviewing public accounts independently called?','What independent examination checks public spending and accounts?','Audit'],
['What is the legal principle that courts can review whether government action is lawful called?','What power allows courts to assess the legality of government action?','Judicial review'],
['What is a political system in which power is constitutionally shared between national and regional governments?','What system divides constitutional authority between federal and regional levels?','Federalism'],
['What is the process of transferring authority from central government to local bodies called?','What is the transfer of powers to local government known as?','Devolution'],
['What is a law proposed to a legislature before enactment called?','What is a proposed law presented to a parliament called?','Bill'],
['What is the term for a public official’s personal interest that could affect impartial decisions?','What is it called when an official’s private interests may conflict with public duties?','Conflict of interest'],
['What is the practice of trying to influence public policy on behalf of an interest group called?','What is organized advocacy aimed at influencing policymakers called?','Lobbying'],
['What is the power to reject or block a proposed law called?','What power allows an executive to refuse approval of legislation?','Veto'],
['What is the legal document that sets out the fundamental structure of a state called?','What foundational legal document defines a state’s institutions and powers?','Constitution'],
['What is a state in which religious institutions are formally separate from government often called?','What term describes separation of religious authority and state governance?','Secular state'],
['What is the term for a system where one person holds hereditary head-of-state status?','What form of government typically has a hereditary monarch as head of state?','Monarchy'],
['What is the term for government by a small group of powerful people?','What political term means rule by a small elite group?','Oligarchy'],
['What is the term for the branch of government that interprets laws and resolves legal disputes?','Which branch of government adjudicates cases and interprets law?','Judiciary'],
['What is the branch of government that implements laws and administers public policy?','Which branch carries out laws and manages government administration?','Executive']
];
for (const [q, alt, answer] of politics) add('Politics', q, alt, answer, 'Constitutional texts; parliamentary and electoral commission educational materials.');

const international = [
['Which international organization has a Security Council and General Assembly?','Which global organization includes both a General Assembly and Security Council?','United Nations'],
['Which court in The Hague settles legal disputes between states when they consent to its jurisdiction?','What UN principal judicial organ hears disputes between states?','International Court of Justice'],
['Which organization sets many international rules for trade between member economies?','Which organization administers multilateral trade agreements?','World Trade Organization'],
['Which organization is responsible for international public health coordination within the UN system?','Which UN specialized agency coordinates international public health?','World Health Organization'],
['Which UN agency works on education, science, culture and heritage?','Which UN agency is associated with World Heritage Sites?','UNESCO'],
['Which organization provides loans and policy advice to support international monetary stability?','Which institution works on global monetary cooperation and financial stability?','International Monetary Fund'],
['Which international institution finances development projects and poverty reduction?','Which institution provides development financing to countries?','World Bank'],
['Which alliance is based on collective defence under Article 5 of its founding treaty?','Which transatlantic alliance includes a collective-defence clause in Article 5?','NATO'],
['Which regional organization uses a common market and has institutions such as the European Commission?','Which political and economic union includes the European Commission?','European Union'],
['Which organization represents oil-exporting member countries and coordinates petroleum policies?','Which group is known for coordinating petroleum policies among members?','OPEC'],
['Which international agreement aims to limit global warming and was adopted in 2015?','What 2015 climate agreement seeks to limit global temperature rise?','Paris Agreement'],
['Which 1951 treaty established the foundation for the modern refugee protection system?','What 1951 international treaty concerns the status of refugees?','Refugee Convention'],
['Which UN body is primarily responsible for maintaining international peace and security?','Which UN organ has primary responsibility for international peace and security?','UN Security Council'],
['What is the practice of negotiating between states to manage relations called?','What is the conduct of relations and negotiations between countries called?','Diplomacy'],
['What is a formal agreement between states governed by international law called?','What is a binding agreement between states commonly called?','Treaty'],
['What is the principle that states have legal equality regardless of size called?','What international-law principle treats states as juridically equal?','Sovereign equality'],
['What term describes a state’s supreme authority over its territory and domestic affairs?','What concept describes a state’s authority over its own territory?','Sovereignty'],
['What is a measure restricting trade or financial dealings to pressure a state called?','What international policy tool restricts economic dealings to apply pressure?','Sanction'],
['What is a neutral third party’s role in helping sides negotiate a settlement called?','What conflict-resolution process uses a neutral facilitator?','Mediation'],
['What is the formal process of reducing or ending a conflict through negotiation called?','What is the negotiated process of resolving a conflict called?','Peace process'],
['Which international organization succeeded the League of Nations after World War II?','What global organization was founded in 1945 after the League of Nations era?','United Nations'],
['What is the term for a state’s official representative to another state?','What is a country’s accredited diplomatic representative called?','Ambassador'],
['What is the practice of states working together to address shared issues called?','What is cooperation among countries to solve shared problems called?','Multilateralism'],
['What is a group of countries formed to pursue common economic or political goals called?','What term describes countries cooperating through a regional or international body?','Regional organization'],
['Which organization is known for the annual G7 summit among major advanced economies?','What group holds an annual summit of seven major advanced economies?','G7'],
['Which group includes major advanced and emerging economies and holds leaders’ summits?','What forum includes economies such as China, India, Brazil and the United States?','G20'],
['What is the term for formally recognizing another state or government?','What diplomatic act establishes acceptance of a state or government?','Recognition'],
['What is a state’s official withdrawal from a treaty called when the treaty allows it?','What is formally leaving a treaty called?','Withdrawal'],
['What is the international-law principle that prohibits acquiring territory by force associated with?','Which principle prohibits states from threatening or using force against another state’s territorial integrity?','UN Charter'],
['Which UN agency is associated with international civil aviation standards?','Which UN specialized agency coordinates international civil aviation?','International Civil Aviation Organization']
];
for (const [q, alt, answer] of international) add('International relations', q, alt, answer, 'UN, treaty texts, and official organization histories.');

const flags = [
['Which country’s flag features a red circle on a white field?','A red disc centered on a white field is the flag of which country?','Japan'],
['Which country’s flag is a red maple leaf on a white square between red bars?','Which country uses a maple leaf on its national flag?','Canada'],
['Which country’s flag features a white cross on a red background?','A white cross on a red field is the flag of which country?','Switzerland'],
['Which country’s flag features a golden five-pointed star on a red field?','A yellow star on a red flag identifies which country?','Vietnam'],
['Which country’s flag is known for a cedar tree in the center?','Which country’s national flag features a green cedar tree?','Lebanon'],
['Which country’s flag features a blue Star of David between two blue stripes?','Which country’s flag has a blue Star of David?','Israel'],
['Which country’s flag has a green field with a white crescent and star?','A white crescent and star on green identify which national flag?','Pakistan'],
['Which country’s flag has a large yellow diamond on a green field with a blue globe?','Which country uses a green flag with a yellow diamond and blue globe?','Brazil'],
['Which country’s flag features a black, red and green horizontal tricolor with a Maasai shield?','Which country’s flag includes a Maasai shield and spears?','Kenya'],
['Which country’s flag features a red circle and a blue stripe across a white field?','Which country has a red circle and horizontal blue stripe on its flag?','Laos'],
['Which country’s flag has a white crescent and star on a red field?','A white crescent and star on red is the flag of which country?','Turkey'],
['Which country’s flag features a dragon on a yellow and orange background?','Which Himalayan country has a dragon on its national flag?','Bhutan'],
['Which country’s flag includes a black double-headed eagle on red?','A black double-headed eagle on red identifies which country’s flag?','Albania'],
['Which country’s flag has a blue field with the Union Jack in the canton and stars representing the Southern Cross?','Which country’s flag includes the Union Jack and Southern Cross stars?','Australia'],
['Which country’s flag is a horizontal tricolor of black, red and gold?','Which European country uses black, red and gold horizontal bands?','Germany']
];
for (const [q, alt, answer] of flags) add('Flags and capitals', q, alt, answer, 'Official national flag descriptions published by governments and national reference services.');

const borders = [
['Which two countries share the longest international land border?','The world’s longest international land border is shared by which two countries?',['Canada','United States']],
['Which country borders both Spain and Germany?','Which European country has land borders with Spain and Germany?','France'],
['Which country borders Portugal and France?','Which country lies between Portugal and France?','Spain'],
['Which country is bordered by Germany, Slovakia and Ukraine, among others, and has its capital in Warsaw?','Which country with capital Warsaw borders Germany and Ukraine?','Poland'],
['Which country borders both India and China and has Kathmandu as its capital?','Which Himalayan country between India and China has Kathmandu as capital?','Nepal'],
['Which two countries share the island of Ireland?','Which country shares the island of Ireland with the Republic of Ireland?','United Kingdom'],
['Which country borders the United States to the north and has Ottawa as its capital?','Which country lies north of the United States and has Ottawa as capital?','Canada'],
['Which country is surrounded by Senegal except for its Atlantic coastline?','Which West African country is nearly enclosed by Senegal?','The Gambia'],
['Which country is an enclave surrounded by Italy?','Which small European state is surrounded by Italy and has Vaduz as capital?','San Marino'],
['Which country is an enclave surrounded by Italy and has Vatican City within its capital city?','Which microstate is enclosed by Rome, Italy?','Vatican City'],
['Which country borders both Brazil and Argentina and has Asuncion as its capital?','Which landlocked South American country between Brazil and Argentina has Asuncion as capital?','Paraguay'],
['Which country borders India, China and Pakistan and has Islamabad as its capital?','Which South Asian country has Islamabad as capital and borders India and China?','Pakistan'],
['Which two countries share the island of New Guinea?','Which country shares New Guinea with Papua New Guinea?','Indonesia'],
['Which country has a land border with the United States and is south of it?','Which country borders the United States to the south?','Mexico'],
['Which territory is administered by Morocco and also claimed by the Polisario Front as the Sahrawi Arab Democratic Republic?','What disputed territory in northwest Africa is claimed by both Morocco and the Sahrawi Arab Democratic Republic?','Western Sahara']
];
for (const [q, alt, answer] of borders) add('Borders and territories', q, alt, answer, 'Official country profiles; UN and International Court of Justice materials for disputed territories.');

const questions = [];
for (const fact of facts) {
  questions.push({
    question: fact.question,
    answers: fact.answers,
    category: fact.category,
    source: fact.source
  });
  questions.push({
    question: fact.alternate,
    answers: fact.answers,
    category: fact.category,
    source: fact.source
  });
}

// Keep the target explicit and fail loudly if future edits accidentally change it.
if (questions.length !== 500) {
  throw new Error('Political Trivia bank must contain exactly 500 questions; found ' + questions.length);
}

module.exports = questions;
