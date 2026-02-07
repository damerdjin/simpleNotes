export function getQuestionMaxPoints(q) {
  if (q.subQuestions && q.subQuestions.length > 0) {
    return q.subQuestions.reduce((sum, sq) => sum + (sq.maxPoints || 0), 0);
  }
  return q.maxPoints || 0;
}

export function getExerciseMaxPoints(ex) {
  const directQuestions = ex.questions || [];
  const parts = ex.parts || [];
  if (directQuestions.length === 0 && parts.length === 0) {
    return ex.maxPoints || 0;
  }
  let total = 0;
  for (const q of directQuestions) {
    total += getQuestionMaxPoints(q);
  }
  for (const part of parts) {
    for (const q of (part.questions || [])) {
      total += getQuestionMaxPoints(q);
    }
  }
  return total;
}

export function getAssignmentMaxPoints(assignment) {
  let total = 0;
  for (const ex of (assignment.exercises || [])) {
    total += getExerciseMaxPoints(ex);
  }
  return total;
}

export function hasAnyGradeForExercise(studentGrades, ex) {
  const exGrades = studentGrades?.[ex.id] || {};
  const final = exGrades?.final?.final?.final;
  if (final !== undefined && final !== '') return true;
  const directQuestions = ex.questions || [];
  const parts = ex.parts || [];
  if (directQuestions.length === 0 && parts.length === 0) {
    const d = exGrades?.direct?.direct?.direct;
    return d !== undefined && d !== '';
  }
  for (const q of directQuestions) {
    const qg = exGrades?.direct?.[q.id] || {};
    if (!q.subQuestions || q.subQuestions.length === 0) {
      const v = qg?.direct;
      if (v !== undefined && v !== '') return true;
    } else {
      for (const sq of q.subQuestions) {
        const v = qg?.[sq.id];
        if (v !== undefined && v !== '') return true;
      }
    }
  }
  for (const part of parts) {
    for (const q of (part.questions || [])) {
      const qg = exGrades?.[part.id]?.[q.id] || {};
      if (!q.subQuestions || q.subQuestions.length === 0) {
        const v = qg?.direct;
        if (v !== undefined && v !== '') return true;
      } else {
        for (const sq of q.subQuestions) {
          const v = qg?.[sq.id];
          if (v !== undefined && v !== '') return true;
        }
      }
    }
  }
  return false;
}

export function getStudentExerciseTotal(studentGrades, ex) {
  const exGrades = studentGrades[ex.id] || {};
  const directQuestions = ex.questions || [];
  const parts = ex.parts || [];
  const finalGrade = exGrades['final']?.['final']?.['final'];
  if (finalGrade !== undefined && finalGrade !== '') {
    return parseFloat(finalGrade) || 0;
  }
  if (directQuestions.length === 0 && parts.length === 0) {
    const val = exGrades['direct']?.['direct']?.['direct'];
    return (val !== undefined && val !== '') ? parseFloat(val) || 0 : 0;
  }
  let total = 0;
  for (const q of directQuestions) {
    const qGrades = exGrades['direct']?.[q.id] || {};
    if (!q.subQuestions || q.subQuestions.length === 0) {
      const val = qGrades['direct'];
      total += (val !== undefined && val !== '') ? parseFloat(val) || 0 : 0;
    } else {
      for (const sq of q.subQuestions) {
        const val = qGrades[sq.id];
        total += (val !== undefined && val !== '') ? parseFloat(val) || 0 : 0;
      }
    }
  }
  for (const part of parts) {
    for (const q of (part.questions || [])) {
      const qGrades = exGrades[part.id]?.[q.id] || {};
      if (!q.subQuestions || q.subQuestions.length === 0) {
        const val = qGrades['direct'];
        total += (val !== undefined && val !== '') ? parseFloat(val) || 0 : 0;
      } else {
        for (const sq of q.subQuestions) {
          const val = qGrades[sq.id];
          total += (val !== undefined && val !== '') ? parseFloat(val) || 0 : 0;
        }
      }
    }
  }
  return total;
}

export function hasAnyGradeForAssignment(data, studentId, assignmentId) {
  const sg = data.grades?.[studentId]?.[assignmentId];
  if (!sg) return false;
  const g = sg.global;
  if (g !== undefined && g !== '') return true;
  const a = (data.assignments || []).find(x => x.id === assignmentId);
  if (!a) return false;
  for (const ex of (a.exercises || [])) {
    if (hasAnyGradeForExercise(sg, ex)) return true;
  }
  return false;
}

export function getStudentAssignmentTotal(data, studentId, assignmentId) {
  const assignment = (data.assignments || []).find(a => a.id === assignmentId);
  if (!assignment) return 0;
  const studentGrades = data.grades[studentId]?.[assignmentId] || {};
  let exerciseTotal = 0;
  let hasAnyExGrade = false;
  if (assignment.exercises && assignment.exercises.length > 0) {
    for (const ex of assignment.exercises) {
      if (hasAnyGradeForExercise(studentGrades, ex)) {
        exerciseTotal += getStudentExerciseTotal(studentGrades, ex);
        hasAnyExGrade = true;
      }
    }
  }
  if (hasAnyExGrade) return exerciseTotal;
  if (studentGrades.global !== undefined && studentGrades.global !== '') {
    return parseFloat(studentGrades.global) || 0;
  }
  return 0;
}
