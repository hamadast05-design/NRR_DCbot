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
['South Korea','Seoul'],['Italy','Rome'],['Jamaica','Kingston'],['Japan','Tokyo'],['Jordan','Amman'],
['Kazakhstan','Astana'],['Kenya','Nairobi'],['Kuwait','Kuwait City'],['Kyrgyzstan','Bishkek'],['Laos','Vientiane']

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
['In which year did the Titanic sink on its maiden voyage?','What year did the RMS Titanic sink in the North Atlantic?','1912'],
['Which event began on 1 September 1939 when Germany invaded Poland?','What major war began in Europe after Germany invaded Poland in 1939?','World War II'],
['Which 1969 mission first landed humans on the Moon?','What was the name of the Apollo mission that first landed people on the Moon?','Apollo 11'],
['Which famous wall opened in Berlin in 1989?','What wall that divided a European city came down in 1989?','Berlin Wall'],
['Which assassination in Sarajevo helped trigger World War I?','Which archduke was assassinated in 1914 before World War I?','Archduke Franz Ferdinand'],
['Which US civil rights leader delivered the “I Have a Dream” speech?','Who gave the famous 1963 “I Have a Dream” speech?','Martin Luther King Jr'],
['What was the code name for the Allied D-Day invasion of Normandy?','Which Allied operation began with the Normandy landings in 1944?','Operation Overlord'],
['Which ancient city is associated with the Trojan Horse legend?','What legendary ancient city was the target of the Trojan War?','Troy'],
['Which 1917 revolution ended the rule of Russia’s tsars?','What revolution in 1917 led to the end of Russia’s monarchy?','Russian Revolution'],
['Which US president was assassinated in Dallas in 1963?','Who was the American president killed in Dallas, Texas?','John F. Kennedy'],
['Which 1947 event created the independent states of India and Pakistan?','What was the division of British India into India and Pakistan called?','Partition of India'],
['What attacks took place in the United States on September 11, 2001?','Which 2001 terrorist attacks changed US security and foreign policy?','September 11 attacks'],
['Which 1066 battle led to the Norman conquest of England?','What famous battle in 1066 brought William the Conqueror to England?','Battle of Hastings'],
['Who developed the movable-type printing press in Europe in the 15th century?','Which inventor is famous for spreading movable-type printing in Europe?','Johannes Gutenberg'],
['Which German religious reformer is associated with the start of the Protestant Reformation in 1517?','Who challenged church practices in 1517 and helped begin the Reformation?','Martin Luther'],
['Which document adopted in 1776 announced the American colonies’ independence from Britain?','What 1776 document declared the thirteen American colonies independent?','United States Declaration of Independence'],
['Which Caribbean country became independent from France in 1804 after a revolution led by formerly enslaved people?','Which country became the first independent Black-led republic in 1804?','Haiti'],
['Which amendment abolished slavery throughout the United States in 1865?','What US constitutional amendment formally abolished slavery?','Thirteenth Amendment'],
['Which Japanese transformation beginning in 1868 restored imperial rule and rapidly modernized the country?','What 19th-century period transformed and modernized Japan?','Meiji Restoration'],
['Which canal connecting the Mediterranean and Red seas opened in 1869?','What major shipping canal in Egypt opened in 1869?','Suez Canal'],
['Which two brothers made the first successful powered airplane flight in 1903?','Who are credited with the first powered, controlled airplane flight?','Wright brothers'],
['Which 1918 agreement stopped the fighting on the Western Front in World War I?','What armistice ended the fighting in World War I on 11 November 1918?','Armistice of 11 November 1918'],
['What was the systematic Nazi genocide of six million Jews during World War II called?','What is the name for the Nazi genocide of European Jews?','The Holocaust'],
['Which 1948–1949 operation supplied West Berlin by air during the Soviet blockade?','What airlift supplied West Berlin during the early Cold War?','Berlin Airlift'],
['Which military alliance was founded in 1949 by North American and European countries?','What collective-defence alliance was created in 1949?','NATO'],
['Which Soviet satellite became the first artificial satellite in 1957?','What was the name of the first artificial satellite launched into orbit?','Sputnik 1'],
['Who became the first human to travel into space in 1961?','Which Soviet cosmonaut made the first human spaceflight?','Yuri Gagarin'],
['Which 1962 Cold War confrontation brought the United States and Soviet Union close to nuclear war?','What crisis followed the discovery of Soviet missiles in Cuba in 1962?','Cuban Missile Crisis'],
['Which US civil rights law passed in 1964 outlawed segregation in many public places?','What landmark US law of 1964 prohibited discrimination in public accommodations?','Civil Rights Act of 1964'],
['Which country reunited in 1975 after the end of the Vietnam War?','What country was reunified after the Vietnam War ended in 1975?','Vietnam'],
['Which revolution in 1979 overthrew the monarchy in Iran?','What 1979 uprising led to the end of Iran’s monarchy?','Iranian Revolution'],
['Which 1986 nuclear disaster occurred in what is now Ukraine?','What nuclear accident occurred at a power plant in 1986 in the Soviet Union?','Chernobyl disaster'],
['Which 1989 protests and political changes peacefully ended communist rule in Czechoslovakia?','What was the peaceful 1989 revolution in Czechoslovakia called?','Velvet Revolution'],
['In which year did apartheid-era South Africa hold its first fully multiracial democratic election?','What year did South Africa hold its first democratic election open to all races?','1994'],
['Which 1993 treaty laid the foundation for the modern European Union?','What treaty signed in 1992 and effective in 1993 created the European Union framework?','Maastricht Treaty'],
['Which 1997 agreement transferred Hong Kong from British to Chinese sovereignty?','In what year did Hong Kong return from British to Chinese rule?','1997'],
['Which financial crisis began in 2007–2008 and caused a global recession?','What global economic crisis followed the collapse of the US housing bubble?','Global financial crisis'],
['Which country was the starting point of the Arab Spring in 2010?','In which country did the protests that began the Arab Spring first start?','Tunisia'],
['Which 2016 UK vote supported leaving the European Union?','What was the 2016 public vote on the UK leaving the EU called?','Brexit referendum'],
['Which global health emergency was declared a pandemic by the WHO in March 2020?','What disease outbreak did the WHO characterize as a pandemic in 2020?','COVID-19 pandemic'],
['Which 1990 event formally marked the reunification of East and West Germany?','In what year did East and West Germany officially reunite?','1990'],
['Which 1955 conference in Indonesia became a landmark meeting of Asian and African countries during the Cold War?','What 1955 meeting in Bandung promoted cooperation among Asian and African states?','Bandung Conference'],
];
for (const [q, alt, answer] of history) add('History', q, alt, answer, 'UN historical records; national archives; museum and university history references.');

const politics = [
['Who was the first president of the United States?','Who became the first US president in 1789?','George Washington'],
['Which British prime minister led the United Kingdom for much of World War II?','Who was the UK prime minister during most of World War II?','Winston Churchill'],
['Who was the first woman to become prime minister of the United Kingdom?','Which woman became Britain’s first female prime minister in 1979?','Margaret Thatcher'],
['Which Indian leader is famous for nonviolent protest during the independence movement?','Who was the Indian independence leader associated with nonviolent resistance?','Mahatma Gandhi'],
['Which US president led the country during the American Civil War?','Who was president of the United States during the Civil War?','Abraham Lincoln'],
['Who was the South African anti-apartheid leader who became president in 1994?','Which anti-apartheid leader became South Africa’s president in 1994?','Nelson Mandela'],
['Which US civil rights leader gave the “I Have a Dream” speech?','Who delivered the famous “I Have a Dream” speech in 1963?','Martin Luther King Jr'],
['What do citizens cast in an election to choose between candidates?','What do people submit when they vote in an election?','Votes'],
['What is the legal right to vote called?','What term means the right to vote in elections?','Suffrage'],
['What is a public vote on a specific issue called?','What is a direct vote by the public on a question called?','Referendum'],
['What is the elected head of a city or town government often called?','What title is commonly given to the leader of a city government?','Mayor'],
['What document sets out a country’s basic rules of government?','What foundational document defines a country’s government and laws?','Constitution'],
['What is a person running for an elected position called?','What do we call someone seeking to be elected to office?','Candidate'],
['What is the official process of choosing leaders by voting called?','What process lets voters choose their representatives?','Election'],
['What is the lawmaking body of a country commonly called?','What do we call a national body that debates and passes laws?','Legislature'],
['Which branch of government is mainly responsible for making laws?','Which branch debates and passes legislation?','Legislative branch'],
['Which branch of government is responsible for carrying out laws?','Which branch puts laws and policies into action?','Executive branch'],
['Which branch of government interprets laws and decides court cases?','Which branch includes courts that interpret laws?','Judicial branch'],
['What is the title of the head of government in the United Kingdom?','Who leads the UK government as head of government?','Prime Minister'],
['In which city is the White House located?','What US city is home to the White House?','Washington, D.C.'],
['What building in Washington, D.C. is home to the US Congress?','Where do the US House of Representatives and Senate meet?','United States Capitol'],
['How many senators does each US state elect to the US Senate?','How many seats does each state have in the US Senate?','Two'],
['At what age can most US citizens vote in federal elections?','What is the usual minimum voting age in US federal elections?','18'],
['What is a proposed law presented to a legislature called?','What do lawmakers call a proposal for a new law before it is passed?','Bill'],
['What do we call the party currently in power?','What is the term for the party or group leading the government?','Governing party'],
['What is the organized effort to win votes in an election called?','What do candidates do to persuade people to vote for them?','Campaign'],
['Which Cuban revolutionary became the country’s longtime leader after 1959?','Who became Cuba’s leader following the Cuban Revolution?','Fidel Castro'],
['Which US president was in office when the Berlin Wall fell in 1989?','Who was US president when the Berlin Wall opened in 1989?','George H. W. Bush'],
['Which US president was in office when Apollo 11 landed on the Moon in 1969?','Who was US president during the first human Moon landing?','Richard Nixon'],
['Which country did Mahatma Gandhi help lead to independence from Britain?','Gandhi is best known for the independence movement in which country?','India'],

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
['Which territory is administered by Morocco and also claimed by the Polisario Front as the Sahrawi Arab Democratic Republic?','What disputed territory in northwest Africa is claimed by both Morocco and the Sahrawi Arab Democratic Republic?','Western Sahara']
];
for (const [q, alt, answer] of borders) add('Borders and territories', q, alt, answer, 'Official country profiles; UN and International Court of Justice materials for disputed territories.');

add('International relations', 'Which UN programme publishes the annual Human Development Report?', 'Which UN development agency is known for the Human Development Report?', 'United Nations Development Programme', 'United Nations Development Programme official publications.');

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
