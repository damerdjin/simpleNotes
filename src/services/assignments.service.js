export function isDuplicateName(assignments, name, className, editingId) {
  const n = String(name || '').trim().toLowerCase();
  const c = String(className || '').trim();
  return (assignments || []).some(a =>
    a.id !== editingId &&
    String(a.className || '').trim() === c &&
    String(a.name || '').trim().toLowerCase() === n
  );
}

export function deepCloneExercisesForEdit(exs) {
  const clone = JSON.parse(JSON.stringify(exs || []));
  return clone.map(ex => {
    const e = { ...ex, defaultGrade: '' };
    if (e.questions) {
      e.questions = e.questions.map(q => ({ ...q, defaultGrade: '' }));
      e.questions = e.questions.map(q => {
        if (q.subQuestions) {
          q.subQuestions = q.subQuestions.map(sq => ({ ...sq, defaultGrade: '' }));
        }
        return q;
      });
    }
    if (e.parts) {
      e.parts = e.parts.map(p => ({
        ...p,
        questions: (p.questions || []).map(q => ({
          ...q,
          defaultGrade: '',
          subQuestions: (q.subQuestions || []).map(sq => ({ ...sq, defaultGrade: '' }))
        }))
      }));
    }
    return e;
  });
}

export function makeGlobalExercises(existingAssignment, globalMaxPoints, globalDefaultGrade, genIdFn) {
  let exId = genIdFn();
  if (existingAssignment && existingAssignment.exercises && existingAssignment.exercises.length > 0) {
    exId = existingAssignment.exercises[0].id;
  }
  return [{
    id: exId,
    name: '',
    maxPoints: globalMaxPoints,
    defaultGrade: globalDefaultGrade,
    questions: [],
    parts: []
  }];
}
