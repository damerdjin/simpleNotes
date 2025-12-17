// remarks.messages.js
// Messages courts pour bulletins (Observation = Devoir vs Composition, Conseil = moyenne)

export const REMARKS = {
  // Paliers CONSEIL (selon la moyenne)
  avgBands: [
    { min: 0.00,  max: 5.99  },
    { min: 6.00,  max: 8.99  },
    { min: 9.00,  max: 9.99  },
    { min: 10.00, max: 11.90 },
    { min: 12.00, max: 13.99 },
    { min: 14.00, max: 15.99 },
    { min: 16.00, max: 17.99 },
    { min: 18.00, max: 18.99 },
    { min: 19.00, max: 20.00 }
  ],

  // Paliers OBSERVATION (Devoir - Composition)
  // diff = devoir - composition
  diffBands: [
    { min: -20.0, max: -4.0 },   // Composition nettement supérieure
    { min: -3.99, max: -2.0 },
    { min: -1.99, max: -0.5 },
    { min: -0.49, max:  0.49 },  // quasi égal
    { min:  0.5,  max:  1.99 },
    { min:  2.0,  max:  3.99 },
    { min:  4.0,  max:  20.0 }   // Devoir nettement supérieur
  ],

  // Conseils par langue et par palier moyenne
    observation: {
    FR: [
      ["Excellent en devoirs, mais les évaluations vous dépassent encore. Travaillez sur la gestion du stress et le temps pendant les tests."],
      ["Vous brillez en devoirs, mais vous manquez d'assurance en compositions. Pratiquez sur des sujets complets et chronométrés."],
      ["Un petit manque de confiance en situation d'examen. Continuez comme ça en devoirs, mais entraînez-vous davantage en conditions réelles."],
      ["Vos résultats sont réguliers et fiables. Vous travaillez de manière cohérente et réfléchie."],
      ["Vous progressez mieux dans le travail régulier qu'aux tests. Renforcez votre capacité à réfléchir sous pression."],
      ["Les examens vous posent problème : stress ou gestion du temps? Analysez ce qui vous ralentit en composition."],
      ["Vous êtes très à l'aise en devoirs mais vous vous effondrez en examen. Il y a une vraie difficulté sous pression. Cherchez de l'aide."]
    ],
    EN: [
      ["You excel at homework, but exams challenge you. Work on stress management and time awareness during tests."],
      ["You shine with assignments, but lose confidence in exams. Practice full tests under timed conditions."],
      ["Slight exam anxiety. Keep excelling at homework, but train more in real test conditions."],
      ["Your results are consistent and reliable. You work steadily and thoughtfully."],
      ["You progress better in regular work than under exam pressure. Build your ability to think clearly under stress."],
      ["Exams are your weak point: stress or time management? Figure out what slows you in compositions."],
      ["Excellent in homework, but exams expose gaps. Real pressure problem. Seek guidance."]
    ],
    AR: [
      ["متفوق في الفروض، لكن الاختبارات تفوق قدرتك حالياً. اعمل على إدارة التوتر والوقت أثناء الاختبارات."],
      ["تتفوق في الفروض، لكن تفقد الثقة في الاختبارات. تدرب على اختبارات كاملة بضغط زمني."],
      ["قلق طفيف من الاختبارات. استمر في التفوق في الفروض، لكن تدرب أكثر في ظروف حقيقية."],
      ["نتائجك منسجمة وموثوقة. تعمل بانتظام وتفكير عميق."],
      ["تتقدم أفضل في العمل المنتظم منه تحت الضغط. طور قدرتك على التفكير الواضح تحت الضغط."],
      ["الاختبارات نقطة ضعفك: توتر أم إدارة وقت؟ اكتشف ما يعطلك في الاختبارات."],
      ["ممتاز في الفروض، لكن الاختبارات تكشف ثغرات. مشكلة حقيقية تحت الضغط. اطلب المساعدة."]
    ]
  },

  // Conseils par moyenne (reste similaire mais amélioré)
  advice: {
    FR: [
      ["Reprendre les bases pas à pas avec rigueur. Une heure chaque jour, c'est plus efficace qu'une marathon hebdomadaire."],
      ["Consolider les essentiels. Maîtrisez chaque concept avant de passer au suivant. Ne laissez rien au hasard."],
      ["Objectif clair : atteindre 10. Identifiez vos points faibles et entraînez-vous spécifiquement dessus."],
      ["Cap bon : viser la stabilité et la méthode. Développez un système de révision régulière."],
      ["Résultats corrects. Visez la précision : éliminez les erreurs bêtes par une relecture systématique."],
      ["Bon niveau. Visez l'excellence en approfondissant et en variant vos approches."],
      ["Très bon travail. Passez à des problèmes plus complexes. Mentalisez, posez des questions."],
      ["Excellent. Aidez les autres, explorez des chemins alternatifs, challengez-vous."],
      ["Performance exceptionnelle. Vous êtes un modèle. Partagez vos techniques, mentorez."]
    ],
    EN: [
      ["Rebuild fundamentals step by step, rigorously. One hour daily beats a marathon session weekly."],
      ["Solidify essentials. Master each concept before moving forward. Leave nothing to chance."],
      ["Clear goal: reach 10+. Find weak spots and train specifically on them."],
      ["Good direction. Aim for stability and method. Build a regular revision habit."],
      ["Solid results. Target precision: eliminate careless errors through systematic review."],
      ["Good level. Chase excellence by deepening understanding and trying new approaches."],
      ["Very good work. Move to complex problems. Reflect, question, analyze deeply."],
      ["Excellent. Help peers, explore alternatives, challenge yourself constantly."],
      ["Exceptional performance. You're a model. Share your methods, mentor others."]
    ],
    AR: [
      ["أعد البناء خطوة بخطوة. ساعة واحدة يومياً أفضل من جلسة ماراثونية أسبوعية."],
      ["ثبّت الأساسيات. أتقن كل مفهوم قبل الانتقال. لا تترك شيئاً للصدفة."],
      ["هدف واضح: تجاوز 10. ابحث عن نقاط الضعف وتدرب عليها بدقة."],
      ["اتجاه جيد. استهدف الاستقرار والمنهج. طور نظام مراجعة منتظم."],
      ["نتائج سليمة. استهدف الدقة: احذر الأخطاء السخيفة بمراجعة منهجية."],
      ["مستوى جيد. اسعَ للتميز بالفهم العميق وتنويع الأساليب."],
      ["عمل ممتاز. انتقل للمسائل المعقدة. تأمل، استفسر، حلل."],
      ["ممتاز. ساعد زملاءك، اكتشف طرقاً بديلة، تحدَّ نفسك."],
      ["أداء استثنائي. أنت قدوة. شارك أساليبك، علّم الآخرين."]
    ]
  }
};
