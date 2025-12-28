// remarks.messages.js
// Messages professionnels + chaleureux, multi-langues
// Structure: matrice [écart_type][palier_moyenne] → message personnalisé

export const REMARKS = {
  // Paliers moyenne pour les conseils
  avgBands: [
    { min: 0.00, max: 4.99 },    // 0
    { min: 5.00, max: 7.50 },    // 1
    { min: 7.51, max: 9.99 },    // 2
    { min: 10.00, max: 11.90 },    // 3
    { min: 12.00, max: 13.99 },    // 4
    { min: 14.00, max: 15.99 },    // 5
    { min: 16.00, max: 17.99 },    // 6
    { min: 18.00, max: 18.99 },    // 7
    { min: 19.00, max: 20.00 }     // 8
  ],

  // Paliers écart devoir - composition
  diffBands: [
    { min: -20.0, max: -4.0 },   // 0: Comp >> Devoir (paradoxe)
    { min: -3.99, max: -2.0 },   // 1: Comp nettement mieux
    { min: -1.99, max: -0.5 },   // 2: Comp légèrement mieux
    { min: -0.49, max: 0.49 },  // 3: Équilibré
    { min: 0.5, max: 1.99 },  // 4: Devoir légèrement mieux
    { min: 2.0, max: 3.99 },  // 5: Devoir nettement mieux
    { min: 4.0, max: 20.0 }   // 6: Devoir >> Comp (stress exam grave)
  ],

  // Matrice observations: [diff_type][avg_band] → messages
  // Personnalisé: reconnaît le pattern psychopédagogique
  observations: {
    FR: [
      // 0: Comp bien meilleur (paradoxe rare, positif à souligner)
      [
        "Surprenant, mais vous êtes plus performant en composition qu'en devoir. Vous trouvez votre rythme sous pression. Continuez à cultiver cette assurance.",
        "Vous brillez davantage aux examens qu'aux devoirs. C'est rare et précieux! Gardez cette confiance en vous et cette résilience.",
        "Vous trouvez votre meilleur niveau lors des compositions. Cela montre une belle capacité à vous concentrer quand ça compte. Valorisez cette force.",
        "Vos compositions dépassent largement vos devoirs. Vous avez un vrai potentiel d'évoluer rapidement. Travaillez à transférer cette énergie en devoir.",
        "Vous performez bien mieux aux compositions. C'est le signe d'une vraie motivation quand ça compte. Construisez sur cette force.",
        "Excellente performance en composition malgré des devoirs moins solides. Vous avez ce qu'il faut pour progresser rapidement.",
        "Votre niveau de composition dépasse vos devoirs. C'est une belle trajectoire ascendante si vous renforcez votre travail régulier.",
        "Vos compositions excellent vraiment. C'est votre terreau de confiance. Nourrissez votre travail régulier avec la même rigueur.",
        "Performance exceptionnelle en composition. Vous êtes capable du meilleur. Projetez cette excellence vers le travail de tous les jours."
      ],
      // 1: Comp nettement mieux
      [
        "Vous préférez les compositions, ce qui révèle du stress en travail régulier. C'est ok : cherchez progressivement du calme et du rythme en devoir.",
        "Vous avez de meilleures notes en composition. C'est peut-être que le contexte vous pousse? Travaillez à retrouver ce dynamisme en devoir.",
        "Compositions meilleures : c'est un signe de motivation sous pression. Canalisez cette énergie vers vos devoirs aussi.",
        "Vous performez mieux en composition : excellent. Maintenez cette énergie et apportez-la progressivement à vos devoirs réguliers.",
        "Composition solide, devoir plus faible. Vous avez de bonnes bases : appliquez-les avec régularité aussi.",
        "Vos compositions sont bien au-dessus de vos devoirs. Vous pouvez mieux faire au quotidien. Une question de régularité et de confiance.",
        "Excellente composition, mais décrochage en devoir. Vous avez le potentiel: maintenez cette rigueur tous les jours.",
        "Composition très solide, devoir léger. Vous montrez ce dont vous êtes capable: demandez-vous pourquoi pas en devoir?",
        "Performance forte en composition. Vous avez vraiment du potentiel. Vos devoirs en découlent : soyez aussi sérieux qu'à l'examen."
      ],
      // 2: Comp légèrement mieux
      [
        "Vous êtes légèrement meilleur en composition. Un petit manque d'assurance en devoir? Vous êtes capable : faites-vous confiance.",
        "Composition un peu mieux : bravo. Il y a juste une nuance de confiance à gagner en devoir. Vous êtes presque au même niveau.",
        "Léger décalage : composition meilleure. C'est un signe de progression. Stabilisez-vous en continuant votre bonne dynamique.",
        "Vous êtes quasi au même niveau partout. Un petit avantage en composition : continuez cette trajectoire positive.",
        "Composition légèrement devant. Vous êtes régulier et fiable. Maintenez cet équilibre, c'est votre force.",
        "Presque parfaitement équilibré, avec composition légèrement devant. Vous avez une belle continuité. Progressez ensemble.",
        "Composition légèrement meilleure : normal, vous consolidez vos acquis. Continuez cette progression régulière.",
        "Très équilibré globalement. Une petite avance en composition. Vous progressez bien. Gardez ce rythme.",
        "Composition légèrement en avant : très bon signe de régularité et de progression. Vous êtes sur la bonne voie."
      ],
      // 3: Équilibré
      [
        "Vos résultats sont réguliers et cohérents. C'est une force : continuez votre travail sérieux et méthodique.",
        "Parfaitement équilibré partout. Vous avez une belle régularité. C'est du travail de qualité : approfondissez maintenant.",
        "Vous êtes stable et fiable. Vos efforts constants se voient. C'est une belle base de progression.",
        "Très cohérent dans vos résultats. Vous avez du sérieux. Continuez, vous êtes sur la bonne voie.",
        "Régularité et stabilité. Excellent : vous progresserez en renforçant cette rigueur existante.",
        "Équilibre et cohérence partout. Vous montrez une vraie maturité de travail. C'est une belle force.",
        "Parfaitement régulier. Vous travaillez avec sérieux et constance. Consolidez et approfondissez maintenant.",
        "Très stable à ce niveau. Votre régularité est votre atout. Utilisez cette base solide pour atteindre l'excellence.",
        "Cohérence remarquable. Vous êtes fiable et sérieux. Visez maintenant l'excellence en approfondissant."
      ],
      // 4: Devoir légèrement mieux
      [
        "Vous vous débrouillez bien en devoir, mais avez du mal à maintenir ce niveau en composition. Le stress? Travaillez votre gestion du stress progressivement.",
        "Devoir un peu meilleur : vous êtes plus à l'aise en routine. C'est normal au début. Progressivement, vous maîtriserez aussi les conditions d'examen.",
        "Vous préférez le travail régulier à l'examen. C'est votre profil : acceptez-le et travaillez à élargir votre confort d'examen.",
        "Devoir légèrement devant : vous avez besoin de temps pour assimiler. C'est ok. Continuez votre travail régulier et progressez graduellement.",
        "Vous êtes meilleur en devoir : c'est normal, c'est la zone confortable. Travaillez maintenant à reproduire ce niveau en composition.",
        "Avantage devoir : vous êtes sérieux au quotidien. Bravo. Maintenant, apportez cette rigueur aux évaluations aussi.",
        "Devoir devant composition : vous avez les bases. Renforcez votre confiance sous pression et vous rattrapperez facilement.",
        "Meilleur en devoir : vous construisez solide. Continuez et progressivement habituez-vous aux conditions d'examen.",
        "Devoir plus fort : excellent. Vous avez une belle trajectoire en construction. Visez maintenant à transposer cette solidité aux tests."
      ],
      // 5: Devoir nettement mieux
      [
        "Vous êtes nettement meilleur en devoir qu'en composition. C'est un signal : l'examen vous stresse. Cherchons ensemble à améliorer ça progressivement.",
        "Gros écart : devoir bien meilleur. Vous avez clairement du mal en composition. C'est un travail important à faire sur la confiance.",
        "Devoir nettement plus solide. Vous montrez ce dont vous êtes capable au quotidien. L'examen vous freine : travaillez à déstresser.",
        "Écart notable : devoir devant. Vous avez les bases, mais elles s'effritent sous pression. C'est normal : renforcez progressivement.",
        "Vous décrchez en composition malgré un bon devoir. C'est le moment de chercher des stratégies pour rester calme en examen.",
        "Devoir bien au-dessus : vous avez une vraie difficulté en conditions d'examen. Cela se travaille : cherchons ensemble.",
        "Écart important devoir-composition. Vous êtes capable du meilleur en devoir. L'examen est votre défi : on va le relever ensemble.",
        "Devoir solide, composition en retrait. Vous avez du potentiel. Travaillons à transformer ce potentiel en performance d'examen aussi.",
        "Devoir excellent, composition plus faible. Vous avez le niveau. C'est une question d'habitude et de confiance en examen."
      ],
      // 6: Devoir bien supérieur (stress grave)
      [
        "Vous êtes très à l'aise en devoir mais vous vous effondrez en composition. C'est une vraie panique d'examen qui mérite de l'attention. Parlons-en.",
        "Écart énorme : devoir >> composition. C'est un signal d'alerte bienveillante. Vous avez clairement besoin d'aide pour gérer l'examen.",
        "Vous excellez en devoir mais vous êtes paralysé en composition. C'est une anxiété d'examen marquée. Cherchons à la dépasser ensemble progressivement.",
        "Décrochage majeur en composition. Vous avez le niveau (vos devoirs le prouvent), mais quelque chose vous bloque en examen. On va travailler ça.",
        "Vous perfomez au quotidien mais vous vous effondrez à l'examen. C'est une vraie difficulté qui nécessite du soutien et de la stratégie.",
        "Écart impressionnant entre devoir et composition. Vous avez clairement une peur de l'examen. C'est ok, mais ça se travaille. Parlons-en.",
        "Devoir excellent, composition catastrophique. Vous avez les bases mais un blocage mental en examen. C'est une vraie difficulté à adresser.",
        "Vous êtes capable du meilleur (vos devoirs le montrent) mais vous êtes paralysé en examen. C'est une vraie difficulté à adresser.",
        "Écart massif : devoir bien au-dessus de composition. Vous avez du potentiel mais une vraie anxiété d'examen. Cherchons à la comprendre et la surmonter."
      ]
    ],

    EN: [
      // 0: Comp bien meilleur
      [
        "Surprisingly, you perform better in exams than in homework. You find your rhythm under pressure. Keep nurturing this confidence.",
        "You shine in exams more than homework. That's rare and valuable! Protect and build on this resilience.",
        "You excel under test conditions. This shows real focus and composure when it matters. Value this strength.",
        "Your exams far exceed your homework. You have real potential to grow quickly. Transfer this energy to daily work.",
        "You perform much better in exams. That's a sign of true motivation when stakes are high. Build on this strength.",
        "Strong exam performance despite lighter homework. You have what it takes to progress rapidly.",
        "Your exam level exceeds homework. That's a beautiful upward trajectory if you strengthen your daily work.",
        "Your exams are excellent. That's your confidence ground. Bring the same rigor to your homework.",
        "Exceptional exam performance. You're capable of excellence. Project this into your daily work too."
      ],
      // 1: Comp nettement mieux
      [
        "You prefer exams, which shows some stress with regular work. That's okay: find calm and rhythm in homework gradually.",
        "Better exam scores reveal something about your motivation. Channel this energy into homework too.",
        "You perform better in exams: excellent. Maintain this energy and bring it to daily assignments.",
        "Exams are solid, homework lighter. You have good foundations: apply them consistently too.",
        "Your exams well above homework. You can do better daily. It's a matter of regularity and confidence.",
        "Strong exams, weak homework. You have potential: keep this rigor daily.",
        "Strong exams, light homework. You show what you're capable of: ask why not daily?",
        "Strong exam performance. You truly have potential. Your homework should reflect it.",
        "Strong exam performance. You have real potential. Your homework stems from this: be as serious as at exams."
      ],
      // 2: Comp légèrement mieux
      [
        "Slightly better in exams. A little confidence gap in homework? You're capable: trust yourself.",
        "Exam a bit better: great. Just a touch of confidence to gain in homework. You're nearly at the same level.",
        "Small gap: exam better. That's normal progression. Keep this positive trajectory.",
        "Nearly identical everywhere with slight exam advantage. Continue this positive path.",
        "Exam slightly ahead. You're reliable and consistent. Keep this balance; it's your strength.",
        "Nearly perfectly balanced with exam slightly ahead. You have nice continuity. Progress together.",
        "Exam slightly better: normal as you consolidate. Continue this steady progression.",
        "Very balanced overall. Small advance in exams. You're progressing well. Keep this pace.",
        "Exam slightly ahead: very good sign of consistency and progression. You're on track."
      ],
      // 3: Équilibré
      [
        "Your results are consistent and coherent. That's a strength: keep your serious, methodical work.",
        "Perfectly balanced everywhere. You have great regularity. That's quality work: deepen it now.",
        "You're stable and reliable. Your constant effort shows. That's a solid foundation for growth.",
        "Very consistent results. You show seriousness. You're on the right path; continue.",
        "Regularity and stability. Excellent: you'll progress by reinforcing this existing rigor.",
        "Balance and consistency everywhere. You show real maturity. That's a real strength.",
        "Perfectly regular. You work seriously and constantly. Consolidate and deepen now.",
        "Very stable at this level. Your regularity is your asset. Use this solid base to reach excellence.",
        "Remarkable consistency. You're reliable and serious. Now aim for excellence by deepening understanding."
      ],
      // 4: Devoir légèrement mieux
      [
        "You do well in homework but struggle under test conditions. Stress? Work on managing it gradually.",
        "Homework slightly better: you're more comfortable in routine. That's normal. Gradually master exam conditions.",
        "You prefer regular work to exams. That's your profile: accept it and work on expanding exam comfort.",
        "Homework slightly ahead: you need time to absorb. That's okay. Continue and progress gradually.",
        "Better in homework: that's normal, it's your comfortable zone. Now bring this rigor to exams too.",
        "Homework advantage: you're serious daily. Great. Now bring this rigor to evaluations too.",
        "Homework ahead: you're building solid. Reinforce confidence under pressure and you'll catch up easily.",
        "Better in homework: excellent. You're building a nice trajectory. Now transpose this to tests.",
        "Homework stronger: excellent. You're building well. Now project this excellence to tests."
      ],
      // 5: Devoir nettement mieux
      [
        "You're significantly better in homework than exams. That's a signal: exams stress you. Let's work on this progressively.",
        "Big gap: homework well ahead. You clearly struggle in exams. That's important work on confidence.",
        "Homework much stronger. You show what you're capable of daily. Exams block you: work on destressing.",
        "Notable gap: homework ahead. You have foundations but they crumble under pressure. Let's reinforce gradually.",
        "You drop in exams despite good homework. Time to find strategies for calm exam performance.",
        "Homework well above: you have real exam difficulty. That's something to work on together.",
        "Big homework-exam gap. You're capable in homework. Exams are your challenge: let's solve it together.",
        "Solid homework, weaker exams. You have potential. Let's transform potential into exam performance.",
        "Strong homework, weaker exams. You have the level. It's about habit and confidence under exam pressure."
      ],
      // 6: Devoir bien supérieur (stress grave)
      [
        "You excel in homework but freeze in exams. That's real exam panic deserving attention. Let's talk about it.",
        "Huge gap: homework >> exams. That's a gentle warning signal. You clearly need help managing exams.",
        "You excel in homework but struggle in exams. That's marked exam anxiety. Let's work through this together.",
        "Major exam drop. You have the level (homework proves it), but something blocks you in exams. We'll work on it.",
        "You perform daily but collapse in exams. That's a real difficulty needing support and strategy.",
        "Impressive homework-exam gap. You clearly have exam fear. It's okay, but it's workable. Let's discuss it.",
        "Strong homework, catastrophic exams. You have foundations but mental blocking in exams. That's real and addressable.",
        "You're capable of excellence (homework shows) but paralyzed in exams. That's real anxiety needing support.",
        "Massive gap: homework well above exams. You have potential but real exam anxiety. Let's understand and overcome it."
      ]
    ],

    AR: [
      // 0: Comp bien meilleur
      [
        "غريب، لكنك أفضل أداءً في الاختبارات منك في الفروض. تجد إيقاعك تحت الضغط. استمر في تنمية هذه الثقة.",
        "تتفوق في الاختبارات أكثر من الفروض. هذا نادر وثمين! احمِ واستثمر هذه القدرة.",
        "تتفوق تحت ضغط الاختبار. هذا يظهر تركيزاً وهدوءاً حقيقياً. قدّر هذه القوة.",
        "اختباراتك تفوق الفروض كثيراً. لديك إمكانية حقيقية للتقدم السريع. احمِ هذه الطاقة.",
        "تؤدي أفضل في الاختبارات. هذا يدل على دافعية حقيقية عندما تكون الرهانات عالية.",
        "أداء قوي في الاختبار رغم الفروض الخفيفة. لديك كل المؤهلات للتقدم السريع.",
        "مستواك في الاختبار يفوق الفروض. هذه مسارية صعودية جميلة إذا قويت الفروض.",
        "اختباراتك ممتازة. هذا أساس ثقتك. احمِ هذا الجدية للفروض.",
        "أداء استثنائي في الاختبار. أنت قادر على التميز. احمِ هذا في عملك اليومي."
      ],
      // 1: Comp nettement mieux
      [
        "تفضل الاختبارات، مما يكشف ضغطاً في العمل المنتظم. لا بأس: ابحث عن الهدوء تدريجياً.",
        "درجات اختبار أفضل تكشف شيئاً عن دافعيتك. سخّر هذه الطاقة للفروض.",
        "تؤدي أفضل في الاختبارات: ممتاز. احافظ على هذه الطاقة وأحضرها للفروض.",
        "الاختبار جيد، الفروض أخف. لديك أساسيات جيدة: طبقها بانتظام.",
        "اختباراتك أفضل كثيراً من الفروض. تستطيع فعل أفضل يومياً. الأمر يتعلق بالانتظام والثقة.",
        "اختبارات قوية، فروض خفيفة. لديك إمكانية: احتفظ بهذه الجدية يومياً.",
        "اختبار قوي، فروض خفيفة. تظهر ما تستطيع: لماذا لا يومياً؟",
        "أداء اختبار قوي. لديك إمكانية حقيقية. يجب أن تنعكس في فروضك.",
        "أداء اختبار قوية. لديك إمكانية حقيقية. فروضك يجب أن تعكس هذا المستوى."
      ],
      // 2: Comp légèrement mieux
      [
        "أفضل قليلاً في الاختبار. فجوة ثقة صغيرة في الفروض؟ أنت قادر: ثق بنفسك.",
        "الاختبار أفضل قليلاً: ممتاز. فقط لمسة من الثقة في الفروض. أنت قريب جداً.",
        "فجوة صغيرة: اختبار أفضل. هذا تقدم طبيعي. احافظ على هذه الحركة.",
        "متطابق تقريباً مع ميزة اختبار صغيرة. استمر في هذا المسار.",
        "الاختبار متقدم قليلاً. أنت موثوق وثابت. احتفظ بهذا التوازن؛ هذه قوتك.",
        "متوازن تقريباً تماماً مع تقدم اختبار طفيف. لديك استمرارية جميلة. تقدم معاً.",
        "اختبار أفضل قليلاً: طبيعي وأنت تثبت. استمر في هذا التقدم المنتظم.",
        "متوازن جداً بشكل عام. تقدم صغير في الاختبار. تتقدم بشكل جيد. احتفظ بهذا الإيقاع.",
        "اختبار متقدم قليلاً: علامة جيدة جداً على الانتظام والتقدم. أنت على الطريق الصحيح."
      ],
      // 3: Équilibré
      [
        "نتائجك منسجمة ومتماسكة. هذه قوة: استمر في عملك الجاد والمنهجي.",
        "متوازن تماماً في كل مكان. لديك انتظام رائع. هذا عمل عالي الجودة: عمّقه الآن.",
        "أنت مستقر وموثوق. جهودك المستمرة واضحة. هذا أساس قوي للنمو.",
        "نتائج متسقة جداً. أنت تظهر جدية. أنت على الطريق الصحيح؛ استمر.",
        "انتظام واستقرار. ممتاز: ستتقدم بتقوية هذه الجدية الموجودة.",
        "توازن واتساق في كل مكان. أنت تظهر نضجاً حقيقياً. هذه قوة حقيقية.",
        "منتظم تماماً. تعمل بجدية واستمرار. ثبّت وعمّق الآن.",
        "مستقر جداً في هذا المستوى. انتظامك هو أصلك. استخدم هذا الأساس لتحقيق التميز.",
        "اتساق ملحوظ. أنت موثوق وجاد. الآن استهدف التميز بتعميق الفهم."
      ],
      // 4: Devoir légèrement mieux
      [
        "تتصرف بشكل جيد في الفروض لكن تواجه صعوبة تحت الاختبار. التوتر؟ اعمل على إدارته تدريجياً.",
        "الفروض أفضل قليلاً: أنت أكثر راحة في الروتين. هذا طبيعي. أتقن تدريجياً ظروف الاختبار.",
        "تفضل العمل المنتظم على الاختبارات. هذا ملفك: اقبله وعمل على توسيع راحتك.",
        "الفروض متقدمة قليلاً: تحتاج وقتاً لاستيعاب. لا بأس. استمر وتقدم تدريجياً.",
        "أفضل في الفروض: طبيعي، إنها منطقتك الآمنة. الآن احضر هذه الجدية للاختبارات.",
        "ميزة الفروض: أنت جاد يومياً. رائع. الآن احضر هذه الجدية للاختبارات.",
        "الفروض متقدمة: تبني بقوة. قوّ ثقتك تحت الضغط وستتقدم بسهولة.",
        "أفضل في الفروض: ممتاز. تبني مسارية جميلة. الآن احمِ هذا للاختبارات.",
        "الفروض أقوى: ممتاز. تبني بشكل جيد. الآن أحضر هذا التميز للاختبارات."
      ],
      // 5: Devoir nettement mieux
      [
        "أنت أفضل بكثير في الفروض منك في الاختبارات. هذا إشارة: الاختبارات تضغط عليك. لنعمل على هذا تدريجياً.",
        "فجوة كبيرة: الفروض متقدمة كثيراً. أنت بوضوح تواجه صعوبة في الاختبارات. هذا عمل مهم على الثقة.",
        "الفروض أقوى بكثير. أنت تظهر ما أنت قادر عليه يومياً. الاختبارات تحجمك: اعمل على إزالة التوتر.",
        "فجوة ملحوظة: الفروض متقدمة. لديك أساسيات لكنها تنهار تحت الضغط. لنقويها تدريجياً.",
        "تتراجع في الاختبارات رغم الفروض الجيدة. حان وقت البحث عن استراتيجيات الهدوء.",
        "الفروض متقدمة كثيراً: لديك صعوبة حقيقية في الاختبارات. هذا شيء نعمل عليه معاً.",
        "فجوة كبيرة في الفروض. أنت قادر في الفروض. الاختبارات تحديك: سنحله معاً.",
        "فروض صلبة، اختبارات أضعف. لديك إمكانية. لنحول هذه الإمكانية إلى أداء اختبار.",
        "فروض قوية، اختبارات أضعف. لديك المستوى. الأمر يتعلق بالعادة والثقة تحت الضغط."
      ],
      // 6: Devoir bien supérieur (stress grave)
      [
        "أنت متفوق جداً في الفروض لكنك تشعر بالشلل في الاختبارات. هذا رعب امتحان حقيقي يستحق الانتباه. لنتحدث عنها.",
        "فجوة ضخمة: الفروض >> الاختبارات. هذه إشارة تحذير لطيفة. أنت بوضوح تحتاج مساعدة في إدارة الاختبارات.",
        "أنت متفوق في الفروض لكن مشلول في الاختبارات. هذا قلق امتحان واضح. لنتغلب عليها معاً.",
        "انهيار كبير في الاختبارات. لديك المستوى (الفروض تثبت ذلك)، لكن شيئاً يحجمك. سنعمل عليها.",
        "تؤدي يومياً لكن تنهار في الاختبارات. هذه صعوبة حقيقية تحتاج دعماً واستراتيجية.",
        "فجوة مثيرة للإعجاب بين الفروض والاختبارات. أنت بوضوح لديك خوف من الاختبار. لا بأس، لكن يمكن العمل عليها.",
        "فروض ممتازة، اختبارات كارثية. لديك أساسيات لكن حجب عقلي في الاختبارات. هذه صعوبة حقيقية.",
        "أنت قادر على التميز (الفروض تثبت) لكنك مشلول في الاختبارات. هذا قلق حقيقي يحتاج دعماً.",
        "فجوة ضخمة: الفروض متقدمة كثيراً. لديك إمكانية لكن قلق امتحان حقيقي. لنفهمها ونتغلب عليها."
      ]
    ]
  },

  // Conseils par moyenne (professionnels, précis, actionnables)
advice: {
    FR: [
        // Palier 0 (0-4) : Rebondir
        [
            "Ne restez pas seul face aux difficultés, sollicitez-nous.",
            "Reprenons ensemble les bases étape par étape.",
            "Courage, c'est en essayant qu'on finit par réussir.",
            "L'important est de ne pas décrocher. Accrochez-vous.",
            "Une remise à plat des méthodes s'impose. On y croit."
        ],
        // Palier 1 (4-6) : Persévérer
        [
            "Chaque petit progrès compte. Ne baissez pas les bras.",
            "La persévérance est votre meilleure alliée.",
            "Ciblez une notion à la fois pour reprendre confiance.",
            "Votre volonté finira par payer. Gardez le cap.",
            "Ne regardez pas la note, regardez ce que vous avez appris."
        ],
        // Palier 2 (6-10) : Franchir le cap
        [
            "Le but est en vue. Encore un peu de rigueur.",
            "Vous progressez. Structurez davantage vos révisions.",
            "Ne lâchez rien, la moyenne est à votre portée.",
            "Soyez plus attentif aux consignes, c'est la clé.",
            "Il manque un déclic méthodologique. Cherchez-le."
        ],
        // Palier 3 (10-12) : Stabiliser
        [
            "La moyenne est franchie. Visez maintenant la solidité.",
            "Régularisez vos efforts pour sécuriser vos acquis.",
            "Participez davantage pour gagner en assurance.",
            "Ne vous reposez pas sur vos lauriers. Consolidez.",
            "Visez plus haut, vous en avez la capacité."
        ],
        // Palier 4 (12-14) : S'affirmer
        [
            "C'est sérieux. Osez prendre plus d'initiatives.",
            "Continuez ainsi, vous êtes sur une très bonne dynamique.",
            "Approfondissez les cours pour viser la mention.",
            "Gagnez en rapidité, vous avez la technique.",
            "Votre travail est propre. Ajoutez-y de l'audace."
        ],
        // Palier 5 (14-16) : Approfondir
        [
            "Belle dynamique. Continuez à soigner les détails.",
            "Votre méthode porte ses fruits, gardez ce rythme.",
            "Soyez curieux, allez au-delà des exercices types.",
            "Vous maîtrisez le cours. Explorez ses subtilités.",
            "Une belle régularité. Visez maintenant l'excellence."
        ],
        // Palier 6 (16-18) : Challenger
        [
            "Très solide. Cherchez la nuance et la complexité.",
            "Challengez-vous sur des problèmes plus ardus.",
            "Votre réflexion s'affine, continuez à creuser.",
            "Ne laissez rien au hasard. Visez la perfection.",
            "Vous avez l'aisance. Travaillez l'originalité."
        ],
        // Palier 7 (18-19) : Exceller
        [
            "Remarquable. Aidez les autres à progresser.",
            "Diversifiez vos sources pour enrichir votre culture.",
            "Visez l'originalité, vous avez les moyens de briller.",
            "Votre niveau vous permet d'explorer des hors-pistes.",
            "Restez curieux et ouvert, c'est votre force."
        ],
        // Palier 8 (19-20) : Inspirer
        [
            "Un parcours inspirant. Continuez à vous dépasser.",
            "Votre soif d'apprendre est un modèle pour la classe.",
            "Conservez cette humilité face au savoir, c'est la clé.",
            "Vous avez l'étoffe des grands. Foncez.",
            "Transmettez votre passion, c'est la prochaine étape."
        ]
    ],
    EN: [
        // Tier 0
        [
            "Don't worry about the start. Let's rebuild together.",
            "Ask questions. There is no shame in learning.",
            "Small steps forward are better than standing still.",
            "Trust the process. We are here to support you.",
            "Focus on one simple goal at a time."
        ],
        // Tier 1
        [
            "Stay strong. Persistence beats talent.",
            "Keep trying. Mistakes are part of the process.",
            "Focus on one topic at a time. You can do this.",
            "Don't give up. Your effort matters more than grades.",
            "Consistency is key. Keep showing up."
        ],
        // Tier 2
        [
            "You are closing the gap. Keep pushing.",
            "Almost there. Organizing your notes will help.",
            "Don't stop now. Your efforts are showing.",
            "Read instructions carefully. You are close.",
            "Believe in yourself. The target is within reach."
        ],
        // Tier 3
        [
            "Safe zone reached. Now build a fortress.",
            "Good job. Consistency is your next challenge.",
            "Believe in yourself and participate more.",
            "Don't settle for average. Aim higher.",
            "Review your lessons daily to stay safe."
        ],
        // Tier 4
        [
            "Solid work. Try to participate more.",
            "You're on the right track. Keep the focus.",
            "Challenge yourself to do a bit more each day.",
            "Your foundation is good. Build on it.",
            "Add a bit more depth to your answers."
        ],
        // Tier 5
        [
            "Great momentum. Focus on precision.",
            "Your hard work is paying off. Stay curious.",
            "Don't settle for 'good'. Aim for 'great'.",
            "Master the details. You are ready.",
            "Show more autonomy. You have the skills."
        ],
        // Tier 6
        [
            "Impressive. Challenge yourself with harder topics.",
            "Think outside the box. Innovation suits you.",
            "Deepen your analysis. You have the skills.",
            "Aim for flawless execution. You can do it.",
            "Explore complex ideas. You are ready."
        ],
        // Tier 7
        [
            "Mastery achieved. Share your knowledge.",
            "Be a leader in the classroom. Help others.",
            "Explore advanced concepts on your own.",
            "Your insight is valuable. Speak up.",
            "Broaden your horizons. Keep exploring."
        ],
        // Tier 8
        [
            "Limitless potential. Truly outstanding.",
            "You set the standard. Keep inspiring us.",
            "The sky is the limit. Wonderful attitude.",
            "A model student. Stay humble and hungry.",
            "Your passion is contagious. Keep it up."
        ]
    ],
    AR: [
        // Tier 0
        [
            "لا تخجل من السؤال. نحن هنا لمساعدتك.",
            "بداية الألف ميل تبدأ بخطوة. ثق بنفسك.",
            "لا تستسلم، كلنا نتعلم من البدايات.",
            "كل مشكلة ولها حل. لنبدأ من جديد.",
            "لا تيأس، الفرصة ما زالت أمامك للتدارك."
        ],
        // Tier 1
        [
            "طريق النجاح يحتاج للصبر. تفاءل خيراً.",
            "المثابرة تصنع المستحيل. واصل المحاولة.",
            "ركز على القليل المتقن خير من الكثير المنقطع.",
            "عزيمتك هي رأس مالك. حافظ عليها.",
            "الأخطاء هي دروس مجانية. تعلم منها."
        ],
        // Tier 2
        [
            "أنت قريب جداً من الهدف. ضاعف الجهد.",
            "نتائجك في تحسن. التنظيم هو الحل.",
            "لا تتوقف، أنت تثبت قدرتك على التجاوز.",
            "الانتباه للتفاصيل سيصنع الفارق.",
            "أنت على بعد خطوة من النجاح. تقدم."
        ],
        // Tier 3
        [
            "تجاوزت العقبة. ركّز الآن على التثبيت.",
            "خطوة جيدة. الاستمرارية هي سر التفوق.",
            "ثق بقدراتك وشارك في الفصل بفعالية.",
            "لا تكتفِ بالنجاح البسيط. طموحك أعلى.",
            "راجع دروسك بانتظام لضمان الاستقرار."
        ],
        // Tier 4
        [
            "عمل جاد. ثق بقدراتك أكثر.",
            "أداء طيب. حافظ على هذا النسق المتصاعد.",
            "اجتهادك واضح. ارفع سقف طموحك.",
            "بداية التميز. كن أكثر جرأة في الطرح.",
            "عمل منظم. أضف إليه لمسة إبداع."
        ],
        // Tier 5
        [
            "نسق رائع. اهتم بدقة التفاصيل.",
            "أحسنت، جهدك اليومي يؤتي ثماره.",
            "كن فضولياً، فالعلم بحر لا ساحل له.",
            "تملك الأدوات اللازمة. تعمّق أكثر.",
            "أداء مستقر. ابحث عن التحدي الآن."
        ],
        // Tier 6
        [
            "مستوى راقٍ. تعمّق في البحث.",
            "تفكيرك ناضج. ابحث عن التحديات الصعبة.",
            "أداؤك متميز. واصل البحث عن التميز.",
            "لا ترضَ بأقل من الإتقان. أنت قادر.",
            "ذكاؤك يحتاج لمسائل أكثر تعقيداً."
        ],
        // Tier 7
        [
            "إتقان مذهل. كُن عوناً لزملائك.",
            "علمك ينمو. شارك معرفتك لترسخ.",
            "تميزك دليل على شغفك. واصل الإبداع.",
            "أنت مشروع عالم صغير. وسّع آفاقك.",
            "قيادة فكرية رائعة. استمر في العطاء."
        ],
        // Tier 8
        [
            "همة تعانق السماء. زادك الله علماً.",
            "أنت قدوة لزملائك. بوركت جهودك.",
            "أداء استثنائي. المستقبل بانتظارك.",
            "نبوغ مبكر. حافظ على تواضع العلماء.",
            "تجمع بين العلم والأخلاق. هنيئاً لك."
        ]
    ]
},

observationsAvg: {
    FR: [
        // Tier 0
        [
            "Difficultés importantes. Bases à reconstruire sereinement.",
            "Niveau fragile. Un accompagnement est nécessaire.",
            "Des lacunes. Il faut reprendre confiance en soi.",
            "Résultats inquiétants. Ne pas se décourager.",
            "Ensemble trop juste. Une réaction est attendue."
        ],
        // Tier 1
        [
            "En cours d'acquisition. Les efforts finiront par payer.",
            "Volontaire mais fragile. Il faut persévérer.",
            "Des progrès timides. Ne relâchez pas l'attention.",
            "Des fragilités persistent. Accrochez-vous.",
            "L'investissement est là. Le niveau va monter."
        ],
        // Tier 2
        [
            "En progrès. La moyenne est à portée de main.",
            "Encourageant. Il manque juste un peu de méthode.",
            "Résultats ascendants. La dynamique est bonne.",
            "Proche du but. Quelques ajustements nécessaires.",
            "Ensemble perfectible. Le potentiel est là."
        ],
        // Tier 3
        [
            "Résultats convenables. Acquis essentiels validés.",
            "Ensemble correct. De la bonne volonté.",
            "Passable. Il faut consolider pour être tranquille.",
            "Moyenne atteinte. Il faut confirmer l'essai.",
            "Début de trimestre correct. Restez vigilant."
        ],
        // Tier 4
        [
            "Bon travail. Élève sérieux et volontaire.",
            "Trimestre satisfaisant. Les efforts sont réguliers.",
            "Une année positive. Continuez ainsi.",
            "Bilan positif. De l'intérêt pour la matière.",
            "Des acquis solides. Une attitude constructive."
        ],
        // Tier 5
        [
            "Très bon niveau. Travail régulier et approfondi.",
            "Des résultats solides. Une attitude exemplaire.",
            "Bravo. De la rigueur et de l'intérêt.",
            "Très satisfaisant. Une belle progression.",
            "Niveau maîtrisé. Des interventions pertinentes."
        ],
        // Tier 6
        [
            "Excellent trimestre. Une maîtrise évidente.",
            "Niveau très solide. Beaucoup de finesse.",
            "Très belle réussite. Élève investi et curieux.",
            "Résultats brillants. Une grande maturité.",
            "Excellence. La réflexion est aboutie."
        ],
        // Tier 7
        [
            "Niveau remarquable. Performance de haute volée.",
            "Brillant. Une compréhension rapide et juste.",
            "Excellence. Une régularité impressionnante.",
            "Prestations de grande qualité. Félicitations.",
            "Un trimestre modèle. Rien à redire."
        ],
        // Tier 8
        [
            "Exceptionnel. Une réussite totale.",
            "Parfait. Rien à ajouter, continuez.",
            "Hors pair. Une maîtrise absolue du sujet.",
            "Sommet atteint. Une aisance déconcertante.",
            "Prestation magistrale. Bravo."
        ]
    ],
    EN: [
        // Tier 0
        [
            "Needs support. Focus on the basics.",
            "Foundational gaps. Let's start fresh.",
            "Significant hurdles. Requires guidance.",
            "struggling with concepts. Keep asking for help.",
            "Requires attention. Don't lose hope."
        ],
        // Tier 1
        [
            "Developing. Keep trying, don't give up.",
            "Effort is there. Results will follow.",
            "Gaining ground. Consistency is needed.",
            "Slow but steady progress. Keep going.",
            "Potential visible. Needs more practice."
        ],
        // Tier 2
        [
            "Improving. Almost at the target.",
            "Promising. Needs a bit more structure.",
            "Upward trend. Keep the momentum going.",
            "Close to passing. Focus on details.",
            "Encouraging signs. Work on methodology."
        ],
        // Tier 3
        [
            "Satisfactory. Core skills unlocked.",
            "Fair results. Good attitude shown.",
            "Average. Foundation is set, now build.",
            "Passable. Needs reinforcement.",
            "Decent start. Stay focused."
        ],
        // Tier 4
        [
            "Good results. Reliable and steady work.",
            "Solid performance. Keep it up.",
            "Pleasing progress. Well done.",
            "Positive outcome. Good engagement.",
            "Serious student. Reliable effort."
        ],
        // Tier 5
        [
            "Very good. Consistent high quality.",
            "Strong level. Great work ethic.",
            "Very capable. Shows deep interest.",
            "Highly satisfactory. Great progress.",
            "Commendable effort. Strong skills."
        ],
        // Tier 6
        [
            "Excellent. Deep understanding shown.",
            "Superior work. Insightful analysis.",
            "Impressive. High standards met.",
            "Top quality work. Very mature.",
            "Brilliant results. Sharp thinking."
        ],
        // Tier 7
        [
            "Outstanding. Top-tier performance.",
            "Brilliant. Quick and sharp mind.",
            "Distinction. Truly remarkable effort.",
            "First-class work. Congratulations.",
            "Model performance. Flawless."
        ],
        // Tier 8
        [
            "Flawless. A standard of its own.",
            "Exceptional. Simply the best.",
            "Perfect score. A joy to teach.",
            "Unmatched mastery. Incredible.",
            "Legendary performance. Well done."
        ]
    ],
    AR: [
        // Tier 0
        [
            "يحتاج مرافقة. الأساسيات قيد البناء.",
            "يواجه صعوبات. يجب إعادة التأسيس.",
            "يحتاج للدعم. لا بد من تدارك الأمر.",
            "النتائج مقلقة. لكن الأمل موجود.",
            "بداية متعثرة. نستطيع تجاوزها معاً."
        ],
        // Tier 1
        [
            "محاولات طيبة. التحسن مسألة وقت.",
            "في طور التعلم. الإرادة موجودة.",
            "بداية الفهم. يحتاج لمزيد من التدريب.",
            "تطور طفيف. الصبر مفتاح الفرج.",
            "الجهد مبذول. النتائج ستتحسن قريباً."
        ],
        // Tier 2
        [
            "في تصاعد. النجاح أصبح قريباً.",
            "مؤشرات جيدة. ينقصه بعض التنظيم.",
            "يتحسن تدريجياً. العزيمة واضحة.",
            "قريب من المعدل. واصل الاجتهاد.",
            "يمكنه التدارك. المؤشرات إيجابية."
        ],
        // Tier 3
        [
            "مقبول. تم تحصيل الأساسيات.",
            "نتيجة مرضية. بداية الاستقرار.",
            "لا بأس به. يجب تثبيت المعلومات.",
            "معدل مطمئن. احذر من التراجع.",
            "بداية موفقة. حافظ على مكانتك."
        ],
        // Tier 4
        [
            "عمل جيد. انضباط وجدية.",
            "مستوى طيب. جهد محترم ومقدر.",
            "نتائج إيجابية. استمرار في العطاء.",
            "أداء منظم. مشاركة فعالة.",
            "تحصيل جيد. التزام واضح."
        ],
        // Tier 5
        [
            "مستوى رفيع. جهد متميز ومستمر.",
            "استيعاب قوي. مشاركة فعالة.",
            "أداء عالٍ. حرص واضح على التعلم.",
            "تطور ملحوظ. نتائج مشرفة.",
            "تحكم ممتاز في المادة. أحسنت."
        ],
        // Tier 6
        [
            "ممتاز. استيعاب عميق للمادة.",
            "متفوق. دقة في الإجابة والتحليل.",
            "رائع. ذكاء واجتهاد في آن واحد.",
            "أداء باهر. فكر نير.",
            "تميز واضح. استيعاب شامل."
        ],
        // Tier 7
        [
            "مبهر. أداء يفوق التوقعات.",
            "نبوغ واضح. فهم سريع ودقيق.",
            "متميز جداً. إتقان يثير الإعجاب.",
            "نتائج راقية. مستوى يبعث الفخر.",
            "تفوق كاسح. هنيئاً لك."
        ],
        // Tier 8
        [
            "قمة التميز. إنجاز بلا أخطاء.",
            "استثنائي. نموذج للطالب المثالي.",
            "إبداع خالص. حفظك الله ووفقك.",
            "علامة كاملة. أداء أسطوري.",
            "لا مزيد لمستزيد. تبارك الله."
        ]
    ]
}

};