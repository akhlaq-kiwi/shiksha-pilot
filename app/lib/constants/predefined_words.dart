class WordEntry {
  final int? id;
  final String word;
  final String hint;
  final String meaning;
  final String hindiMeaning;
  final String sentence;
  final String hindiSentence;
  final String category;

  const WordEntry({
    this.id,
    required this.word,
    required this.hint,
    required this.meaning,
    required this.hindiMeaning,
    required this.sentence,
    required this.hindiSentence,
    required this.category,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'word': word,
    'hint': hint,
    'meaning': meaning,
    'hindiMeaning': hindiMeaning,
    'sentence': sentence,
    'hindiSentence': hindiSentence,
    'category': category,
  };
}

const Map<String, List<WordEntry>> predefinedWords = {
  'pre-primary': [
    WordEntry(
      word: 'CAT',
      hint: 'A small domesticated carnivorous mammal with soft fur.',
      meaning: 'Cat is a small pet animal.',
      hindiMeaning: 'बिल्ली (Billi)',
      sentence: 'The cat is sleeping on the mat.',
      hindiSentence: 'बिल्ली चटाई पर सो रही है।',
      category: 'Animals',
    ),
    WordEntry(
      word: 'DOG',
      hint: 'A common animal kept as a pet or for guarding things.',
      meaning: 'Dog is a loyal pet animal.',
      hindiMeaning: 'कुत्ता (Kutta)',
      sentence: 'The dog barks at strangers.',
      hindiSentence: 'कुत्ता अजनbियों पर भौंकता है।',
      category: 'Animals',
    ),
    WordEntry(
      word: 'SUN',
      hint: 'The star around which the earth revolves.',
      meaning: 'Sun gives us light and heat.',
      hindiMeaning: 'सूरज (Suraj)',
      sentence: 'The sun rises in the east.',
      hindiSentence: 'सूरज पूर्व में उगता है।',
      category: 'Nature',
    ),
    WordEntry(
      word: 'BALL',
      hint: 'A round object that you kick, throw, or hit in games.',
      meaning: 'Ball is used to play games.',
      hindiMeaning: 'गेंद (Gend)',
      sentence: 'He kicked the football.',
      hindiSentence: 'उसने फुटबॉल को लात मारी।',
      category: 'Toys',
    ),
    WordEntry(
      word: 'CAR',
      hint: 'A road vehicle, typically with four wheels, powered by an engine.',
      meaning: 'Car is a vehicle used for travelling.',
      hindiMeaning: 'गाड़ी (Gadi)',
      sentence: 'My father drives a red car.',
      hindiSentence: 'मेरे पिता एक लाल गाड़ी चलाते हैं।',
      category: 'Vehicles',
    ),
    WordEntry(
      word: 'TREE',
      hint: 'A woody perennial plant, typically having a single stem or trunk.',
      meaning: 'Tree is a tall plant with leaves.',
      hindiMeaning: 'पेड़ (Ped)',
      sentence: 'Birds make nests on the tree.',
      hindiSentence: 'पक्षी पेड़ पर घोंसला बनाते हैं।',
      category: 'Nature',
    ),
    WordEntry(
      word: 'BOOK',
      hint: 'A written or printed work consisting of pages glued together.',
      meaning: 'Book is used for reading and studying.',
      hindiMeaning: 'किताब (Kitab)',
      sentence: 'I read an interesting story book.',
      hindiSentence: 'मैंने एक दिलचस्प कहानी की किताब पढ़ी।',
      category: 'Education',
    ),
    WordEntry(
      word: 'FISH',
      hint: 'A limbless cold-blooded vertebrate animal with gills living in water.',
      meaning: 'Fish lives in water and swims.',
      hindiMeaning: 'मछली (Machli)',
      sentence: 'The fish swims in the aquarium.',
      hindiSentence: 'मछली एक्वेरियम में तैरती है।',
      category: 'Animals',
    ),
  ],
  'primary-easy': [
    WordEntry(
      word: 'APPLE',
      hint: 'A round fruit with red, green, or yellow skin and crisp white flesh.',
      meaning: 'Apple is a healthy fruit.',
      hindiMeaning: 'सेब (Seb)',
      sentence: 'I eat an apple every day.',
      hindiSentence: 'मैं रोज़ एक सेब खाता हूँ।',
      category: 'Fruits',
    ),
    WordEntry(
      word: 'TIGER',
      hint: 'A large solitary cat with a yellow-brown coat striped with black.',
      meaning: 'Tiger is the national animal of India.',
      hindiMeaning: 'बाघ (Bagh)',
      sentence: 'The tiger runs very fast in the forest.',
      hindiSentence: 'बाघ जंगल में बहुत तेज़ दौड़ता है।',
      category: 'Animals',
    ),
    WordEntry(
      word: 'GARDEN',
      hint: 'A piece of ground adjoining a house, used for growing flowers, fruit, or vegetables.',
      meaning: 'Garden is a place with flowers and plants.',
      hindiMeaning: 'बगीचा (Bagicha)',
      sentence: 'Beautiful roses are blooming in the garden.',
      hindiSentence: 'बगीचे में सुंदर गुलाब खिल रहे हैं।',
      category: 'Nature',
    ),
    WordEntry(
      word: 'SCHOOL',
      hint: 'An institution for educating children.',
      meaning: 'School is a place where we learn.',
      hindiMeaning: 'विद्यालय (Vidyalay)',
      sentence: 'We go to school to study.',
      hindiSentence: 'हम पढ़ाई करने विद्यालय जाते हैं।',
      category: 'Education',
    ),
    WordEntry(
      word: 'FAMILY',
      hint: 'A group of one or more parents and their children living together as a unit.',
      meaning: 'Family refers to people related to us.',
      hindiMeaning: 'परिवार (Parivar)',
      sentence: 'I love my family very much.',
      hindiSentence: 'मैं अपने परिवार से बहुत प्यार करता हूँ।',
      category: 'People',
    ),
  ],
  'primary-medium': [
    WordEntry(
      word: 'MOUNTAIN',
      hint: "A large natural elevation of the earth's surface rising abruptly.",
      meaning: 'Mountain is a very high hill.',
      hindiMeaning: 'पर्वत (Parvat)',
      sentence: 'Mount Everest is the highest mountain peak.',
      hindiSentence: 'माउंट एवरेस्ट सबसे ऊंची पर्वत चोटी है।',
      category: 'Nature',
    ),
    WordEntry(
      word: 'BEAUTIFUL',
      hint: 'Pleasing the senses or mind aesthetically.',
      meaning: 'Beautiful means looking very pretty.',
      hindiMeaning: 'सुंदर (Sundar)',
      sentence: 'The peacock has beautiful feathers.',
      hindiSentence: 'मोर के पंख सुंदर होते हैं।',
      category: 'Adjectives',
    ),
    WordEntry(
      word: 'JOURNEY',
      hint: 'An act of traveling from one place to another.',
      meaning: 'Journey is a trip or travel.',
      hindiMeaning: 'यात्रा (Yatra)',
      sentence: 'Our train journey was very comfortable.',
      hindiSentence: 'हमारी ट्रेन यात्रा बहुत आरामदायक थी।',
      category: 'General',
    ),
    WordEntry(
      word: 'LIBRARY',
      hint: 'A building or room containing collections of books.',
      meaning: 'Library is a quiet place to read books.',
      hindiMeaning: 'पुस्तकालय (Pustakalay)',
      sentence: 'The school library has thousands of books.',
      hindiSentence: 'स्कूल के पुस्तकालय में हज़ारों किताबें हैं।',
      category: 'Education',
    ),
    WordEntry(
      word: 'ENGINEER',
      hint: 'A person who designs, builds, or maintains engines, machines, or public works.',
      meaning: 'Engineer builds machines or systems.',
      hindiMeaning: 'अभियंता (Abhiyanta)',
      sentence: 'My elder brother is a software engineer.',
      hindiSentence: 'मेरा बड़ा भाई एक software engineer है।',
      category: 'Profession',
    ),
  ],
  'middle-advanced': [
    WordEntry(
      word: 'COURAGE',
      hint: 'The ability to do something that frightens one.',
      meaning: 'Courage is bravery in difficult times.',
      hindiMeaning: 'साहस (Sahas)',
      sentence: 'Soldiers show great courage in battles.',
      hindiSentence: 'सैनिक युद्ध में महान साहस दिखाते हैं।',
      category: 'Values',
    ),
    WordEntry(
      word: 'KNOWLEDGE',
      hint: 'Facts, information, and skills acquired through experience or education.',
      meaning: 'Knowledge is learning and understanding facts.',
      hindiMeaning: 'ज्ञान (Gyaan)',
      sentence: 'Reading books increases our knowledge.',
      hindiSentence: 'किताबें पढ़ने से हमारा ज्ञान बढ़ता है।',
      category: 'Education',
    ),
    WordEntry(
      word: 'ADVENTURE',
      hint: 'An unusual and exciting or daring experience.',
      meaning: 'Adventure is an exciting or risky task.',
      hindiMeaning: 'साहसिक कार्य (Sahasik Karya)',
      sentence: 'Hiking up the hill was a fun adventure.',
      hindiSentence: 'पहाड़ी पर चढ़ना एक मज़ेदार साहसिक कार्य था।',
      category: 'General',
    ),
    WordEntry(
      word: 'CURIOUS',
      hint: 'Eager to know or learn something.',
      meaning: 'Curious means wanting to find out more.',
      hindiMeaning: 'जिज्ञासु (Jigyasu)',
      sentence: 'Children are always curious about nature.',
      hindiSentence: 'बच्चे हमेशा प्रकृति के बारे में जिज्ञासु होते हैं।',
      category: 'Adjectives',
    ),
    WordEntry(
      word: 'EXCELLENT',
      hint: 'Extremely good; outstanding.',
      meaning: 'Excellent means of outstanding quality.',
      hindiMeaning: 'उत्कृष्ट (Utkrisht)',
      sentence: 'She did an excellent job in the science project.',
      hindiSentence: 'उसने विज्ञान परियोजना में उत्कृष्ट कार्य किया।',
      category: 'Adjectives',
    ),
  ],
  'senior-high': [
    WordEntry(
      word: 'INNOVATION',
      hint: 'The action or process of innovating a new method, idea, or product.',
      meaning: 'Innovation is introducing new ideas or methods.',
      hindiMeaning: 'नवाचार (Navachar)',
      sentence: 'Technology thrives on constant innovation.',
      hindiSentence: 'तकनीक निरंतर नवाचार पर फलती-फूलती है।',
      category: 'Science',
    ),
    WordEntry(
      word: 'PHILOSOPHY',
      hint: 'The study of the fundamental nature of knowledge, reality, and existence.',
      meaning: 'Philosophy is the study of deep thoughts.',
      hindiMeaning: 'दर्शनशास्त्र (Darshanshashra)',
      sentence: 'He likes reading ancient Greek philosophy.',
      hindiSentence: 'उसे प्राचीन ग्रीक दर्शनशास्त्र पढ़ना पसंद है।',
      category: 'Humanities',
    ),
    WordEntry(
      word: 'CONSTITUTION',
      hint: 'A body of fundamental principles according to which a state is governed.',
      meaning: 'Constitution is the supreme law book of a nation.',
      hindiMeaning: 'संविधान (Samvidhan)',
      sentence: 'The Constitution ensures equal rights for all citizens.',
      hindiSentence: 'संविधान सभी नागरिकों के लिए समान अधिकार सुनिश्चित करता है।',
      category: 'Civics',
    ),
    WordEntry(
      word: 'ENTREPRENEUR',
      hint: 'A person who sets up a business, taking on financial risks in the hope of profit.',
      meaning: 'Entrepreneur starts new business ventures.',
      hindiMeaning: 'उद्यमी (Udyami)',
      sentence: 'The young entrepreneur started a tech startup.',
      hindiSentence: 'युवा उद्यमी ने एक tech startup शुरू किया।',
      category: 'Business',
    ),
    WordEntry(
      word: 'ARTIFICIAL',
      hint: 'Made or produced by human beings rather than occurring naturally.',
      meaning: 'Artificial means man-made, not natural.',
      hindiMeaning: 'कृत्रिम (Kritrim)',
      sentence: 'Artificial Intelligence is changing the tech world.',
      hindiSentence: 'कृत्रिम बुद्धिमत्ता (AI) तकनीकी दुनिया को बदल रही है।',
      category: 'Science',
    ),
    WordEntry(
      word: 'PSYCHOLOGY',
      hint: 'The scientific study of the human mind and its functions.',
      meaning: 'Psychology is the study of behavior and mind.',
      hindiMeaning: 'मनोविज्ञान (Manovigyan)',
      sentence: 'Understanding child psychology helps in teaching.',
      hindiSentence: 'बाल मनोविज्ञान को समझने से पढ़ाने में मदद मिलती है।',
      category: 'Science',
    ),
  ]
};

String getDifficultyByClass(String? className) {
  if (className == null || className.isEmpty) return 'primary-easy';
  final name = className.toLowerCase();

  if (name.contains('play') ||
      name.contains('nursery') ||
      name.contains('lkg') ||
      name.contains('ukg') ||
      name.contains('kindergarten')) {
    return 'pre-primary';
  }
  if (name.contains('class 1') ||
      name.contains('class 2') ||
      name.contains('grade 1') ||
      name.contains('grade 2') ||
      name.contains('1st') ||
      name.contains('2nd')) {
    return 'primary-easy';
  }
  if (name.contains('class 3') ||
      name.contains('class 4') ||
      name.contains('class 5') ||
      name.contains('grade 3') ||
      name.contains('grade 4') ||
      name.contains('grade 5') ||
      name.contains('3rd') ||
      name.contains('4th') ||
      name.contains('5th')) {
    return 'primary-medium';
  }
  if (name.contains('class 6') ||
      name.contains('class 7') ||
      name.contains('class 8') ||
      name.contains('grade 6') ||
      name.contains('grade 7') ||
      name.contains('grade 8') ||
      name.contains('6th') ||
      name.contains('7th') ||
      name.contains('8th')) {
    return 'middle-advanced';
  }
  return 'senior-high'; // Default / Senior Classes (9-12)
}
