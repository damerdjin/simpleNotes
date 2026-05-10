const fs = require('fs');
let content = fs.readFileSync('src/ui/grades.js', 'utf8');

// The string replacements
const replaces = [
  // 1. Direct Question (line ~189)
  [
    '<div class="relative ${(mode === \\'global\\' || isBlocked) ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'}!" dir="ltr">',
    '<div class="relative ${(mode === \\'global\\' || isBlocked) ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'!}">'
  ],
  [
    'class="w-full p-2.5 pr-8 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700',
    'class="w-full min-w-[80px] p-2.5 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700'
  ],
  [
    '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">/ ${q.maxPoints}</div>',
    '<div class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300 pointer-events-none">/ ${q.maxPoints}</div>'
  ],

  // 2. Simple Assignment (line ~409)
  [
    '<div class="relative w-full" dir="ltr">\\r\\n                             <input type="number" id="grade-simple-${qId}"',
    '<div class="relative w-full">\\r\\n                             <input type="number" id="grade-simple-${qId}"'
  ],
  [
    'class="w-full py-3 sm:py-5 pr-12 sm:pr-16 bg-slate-50 border-2',
    'class="w-full py-3 sm:py-5 bg-slate-50 border-2'
  ],
  [
    '<div class="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-sm sm:text-lg font-black text-slate-400">/ ${maxPts}</div>',
    '<div class="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-xs sm:text-lg font-black text-slate-300 pointer-events-none">/ ${maxPts}</div>'
  ],

  // 3. Global Grade Input (line ~517)
  [
    '<div class="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto border-t border-slate-200 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0 ${modeCur === \\'detail\\' ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'}">\\r\\n                                     <span class="text-[11px] font-bold text-slate-500 uppercase tracking-tight truncate mr-2 sm:mr-0">${t.globalGrade || \\'Note globale\\'} :</span>\\r\\n                                     <div class="relative shrink-0" dir="ltr">',
    '<div class="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto border-t border-slate-200 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0 flex-1 min-w-0 ${modeCur === \\'detail\\' ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'}">\\r\\n                                     <span class="text-[11px] font-bold text-slate-500 uppercase tracking-tight truncate mr-2 sm:mr-0 flex-1 min-w-0">${t.globalGrade || \\'Note globale\\'} :</span>\\r\\n                                     <div class="relative shrink-0">'
  ],
  [
    'class="w-24 p-2 pr-10 bg-white border-2 border-amber-200',
    'class="w-28 min-w-[110px] p-2 bg-white border-2 border-amber-200'
  ],
  [
    '<div class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">/ ${maxExPoints}</div>',
    '<div class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300 pointer-events-none">/ ${maxExPoints}</div>'
  ],

  // 4. Single Simple Question (line ~535)
  [
    '<div class="flex items-center gap-3 shrink-0 w-full sm:w-auto">\\r\\n                                     <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">\\r\\n                                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>\\r\\n                                     </div>\\r\\n                                     <span class="text-xs font-bold text-blue-900">${t.globalGrade || \\'Note globale\\'}</span>\\r\\n                                 </div>\\r\\n                                 <div class="flex items-center gap-3 w-full sm:w-auto">\\r\\n                                     <div class="relative w-full sm:w-32" dir="ltr">',
    '<div class="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">\\r\\n                                     <div class="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">\\r\\n                                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>\\r\\n                                     </div>\\r\\n                                     <span class="text-xs font-bold text-blue-900 break-words">${t.globalGrade || \\'Note globale\\'}</span>\\r\\n                                 </div>\\r\\n                                 <div class="flex items-center gap-3 w-full sm:w-auto shrink-0">\\r\\n                                     <div class="relative w-full sm:w-32">'
  ],
  [
    'class="w-full p-2.5 pr-12 bg-white border-2 border-blue-200',
    'class="w-full min-w-[100px] p-2.5 bg-white border-2 border-blue-200'
  ],
  [
    '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-400">/ ${maxExPoints}</div>',
    '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-300 pointer-events-none">/ ${maxExPoints}</div>'
  ],

  // 5. No Questions (line ~559)
  [
    '<div class="flex items-center gap-3 shrink-0 w-full sm:w-auto">\\r\\n                                     <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">\\r\\n                                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>\\r\\n                                     </div>\\r\\n                                     <span class="text-xs font-bold text-blue-900">${t.grade || \\'Note\\'}</span>\\r\\n                                 </div>\\r\\n                                 <div class="flex items-center gap-3 w-full sm:w-auto">\\r\\n                                     <div class="relative w-full sm:w-32" dir="ltr">',
    '<div class="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">\\r\\n                                     <div class="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">\\r\\n                                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>\\r\\n                                     </div>\\r\\n                                     <span class="text-xs font-bold text-blue-900 break-words">${t.grade || \\'Note\\'}</span>\\r\\n                                 </div>\\r\\n                                 <div class="flex items-center gap-3 w-full sm:w-auto shrink-0">\\r\\n                                     <div class="relative w-full sm:w-32">'
  ],
  [
    'class="w-full p-2.5 pr-12 bg-white border-2 border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm text-sm ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? \\'cursor-not-allowed\\' : \\'\\'}"',
    'class="w-full min-w-[100px] p-2.5 bg-white border-2 border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm text-sm ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? \\'cursor-not-allowed\\' : \\'\\'}"'
  ],
  [
    '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-400">/ ${ex.maxPoints}</div>',
    '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-400 pointer-events-none">/ ${ex.maxPoints}</div>'
  ]
];

for (const [find, replace] of replaces) {
  content = content.replace(find, replace);
}
// wait, for 1. it had a typo !
content = content.replace('<div class="relative ${(mode === \\'global\\' || isBlocked) ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'}" dir="ltr">', '<div class="relative ${(mode === \\'global\\' || isBlocked) ? \\'opacity-40 grayscale pointer-events-none\\' : \\'\\'}">');

fs.writeFileSync('src/ui/grades.js', content);
console.log("Replaced successfully!");
