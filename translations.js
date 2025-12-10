// translations.js
const translations = {
    fr: {
        // Interface générale
        appTitle: "📝 Gestion des Corrections",
        appSubtitle: "Gérez vos élèves, devoirs et notes en toute simplicité",
        
        // Navigation
        studentsTab: "👥 Élèves",
        assignmentsTab: "📋 Devoirs", 
        gradesTab: "🎯 Notes",
        summaryTab: "📊 Récapitulatif",
        
        // Étudiants
        studentsList: "Liste des Élèves",
        addStudent: "+ Ajouter un élève",
        importExcel: "Importer (.xlsx)",
        classManagement: "Gestion des Classes",
        noStudents: "Aucun élève. Ajoutez votre premier élève !",
        deleteStudent: "Supprimer cet élève et toutes ses notes ?",
        student: "Élève",
        students: "élève(s)",
        noStudentsAddFirst: "Aucun élève. Ajoutez votre premier élève !",
        
        // Modal étudiant
        addStudentTitle: "Ajouter un élève",
        lastName: "Nom",
        firstName: "Prénom",
        className: "Classe",
        nin: "NIN (optionnel)",
        cancel: "Annuler",
        add: "Ajouter",
        
        // Devoirs
        assignmentsManagement: "Gestion des Devoirs",
        createAssignment: "+ Créer un devoir",
        filterByClass: "Filtrer par classe",
        allClasses: "-- Toutes les classes --",
        filterByName: "Filtrer par nom de devoir",
        searchAssignment: "Rechercher un devoir...",
        noAssignments: "Aucun devoir. Créez votre premier devoir !",
        noFilteredAssignments: "Aucun devoir ne correspond aux filtres appliqués.",
        editAssignment: "Modifier le Devoir",
        createAssignmentTitle: "Créer un Devoir",
        assignmentName: "Nom du devoir (ex: Devoir 1)",
        selectClass: "-- Sélectionner une classe --",
        addExercise: "+ Ajouter un exercice",
        save: "Enregistrer",
        deleteAssignment: "Supprimer ce devoir et toutes les notes associées ?",
        duplicate: "Dupliquer",
        edit: "Modifier",
        delete: "Supprimer",
        
        // Exercices et questions
        exercise: "Exercice",
        part: "Partie",
        totalPoints: "Total:",
        automaticTotal: "Total automatique",
        addPart: "+ Ajouter une Partie",
        addQuestion: "+ Question",
        addSubQuestions: "+a,b,c",
        deleteExercise: "Supprimer cet exercice ?",
        deletePart: "Supprimer cette partie ?",
        points: "pts",
        exerciseName: "Nom (optionnel)",
        noExercises: "Aucun exercice",
        clickAddExercise: "Cliquez sur '+ Ajouter un exercice' pour commencer.",
        noQuestions: "Exercice sans questions",
        directPointsOnly: "note directe uniquement",
        autoTotalPoints: "Total automatique",
        sumSubQuestions: "somme des sous-questions",
        questionPoints: "Points de la question",
        sumQuestions: "somme des questions",
        
        // Notes
        gradesEntry: "Saisie des Notes",
        selectClass: "-- Sélectionner une classe --",
        selectAssignment: "-- Sélectionner un devoir --",
        selectStudent: "-- Sélectionner un élève --",
        selectClassFirst: "-- Sélectionner d'abord une classe --",
        selectAssignmentAndStudentToGrade: "Sélectionnez un devoir et un élève pour saisir les notes.",
        globalGrade: "Note globale (force le total):",
        ignoresDetails: "Si rempli, ignore le détail des questions ci-dessous.",
        grade: "Note :",
        
        // Récapitulatif
        summaryTitle: "Récapitulatif des Notes",
        search: "Rechercher (nom, prénom, classe)",
        showDetails: "Afficher les détails (exercices)",
        noData: "Ajoutez des élèves et des devoirs pour voir le récapitulatif.",
        noClassData: "Aucun élève ou devoir pour la classe",
        noResults: "Aucun résultat ne correspond à votre recherche.",
        noStudentOrAssignmentForClass: "Aucun élève ou devoir pour la classe",
        noResultForSearch: "Aucun résultat ne correspond à votre recherche.",
        addStudentsAndAssignmentsToSeeSummary: "Ajoutez des élèves et des devoirs pour voir le récapitulatif.",
        
        // Messages d'erreur
        enterName: "Veuillez entrer au moins un nom ou prénom",
        enterAssignmentName: "Veuillez entrer un nom pour le devoir",
        selectAssignmentClass: "Veuillez sélectionner une classe pour ce devoir",
        addExerciseFirst: "Ajoutez au moins un exercice",
        deleteClassConfirm: "Supprimer la classe",
        andStudents: "et ses",
        noClassesAutoCreated: "Aucune classe. Les classes sont créées automatiquement lors de l'ajout d'élèves.",
        
        exerciseAbbr: "ex.",
        selectClassToStart: "Sélectionnez une classe pour commencer",
        globalGrade: "Note globale (force le total):",
        ignoresDetails: "Si rempli, ignore le détail des questions ci-dessous.",
        total: "Total",
        grade: "Note :",
        // Import
        importCompleted: "Import terminé. Nouveaux élèves ajoutés :",
        emptyFile: "Fichier vide ou sans données."
    },
    
    en: {
        // Interface générale
        appTitle: "📝 Grading Management",
        appSubtitle: "Manage your students, assignments and grades easily",
        
        // Navigation
        studentsTab: "👥 Students",
        assignmentsTab: "📋 Assignments",
        gradesTab: "🎯 Grades",
        summaryTab: "📊 Summary",
        
        // Étudiants
        studentsList: "Students List",
        addStudent: "+ Add Student",
        importExcel: "Import (.xlsx)",
        classManagement: "Class Management",
        noStudents: "No students. Add your first student!",
        deleteStudent: "Delete this student and all their grades?",
        student: "Student",
        students: "student(s)",
        noStudentsAddFirst: "No students. Add your first student!",
        
        // Modal étudiant
        addStudentTitle: "Add Student",
        lastName: "Last Name",
        firstName: "First Name",
        className: "Class",
        nin: "NIN (optional)",
        cancel: "Cancel",
        add: "Add",
        
        // Devoirs
        assignmentsManagement: "Assignments Management",
        createAssignment: "+ Create Assignment",
        filterByClass: "Filter by class",
        allClasses: "-- All classes --",
        filterByName: "Filter by assignment name",
        searchAssignment: "Search an assignment...",
        noAssignments: "No assignments. Create your first assignment!",
        noFilteredAssignments: "No assignments match the applied filters.",
        editAssignment: "Edit Assignment",
        createAssignmentTitle: "Create Assignment",
        assignmentName: "Assignment name (ex: Assignment 1)",
        selectClass: "-- Select a class --",
        addExercise: "+ Add Exercise",
        save: "Save",
        deleteAssignment: "Delete this assignment and all associated grades?",
        duplicate: "Duplicate",
        edit: "Edit",
        delete: "Delete",
        
        // Exercices et questions
        exercise: "Exercise",
        part: "Part",
        totalPoints: "Total:",
        automaticTotal: "Automatic total",
        addPart: "+ Add Part",
        addQuestion: "+ Question",
        addSubQuestions: "+a,b,c",
        deleteExercise: "Delete this exercise?",
        deletePart: "Delete this part?",
        points: "pts",
        exerciseName: "Name (optional)",
        noExercises: "No exercises",
        clickAddExercise: "Click on '+ Add Exercise' to start.",
        noQuestions: "Exercise without questions",
        directPointsOnly: "direct grade only",
        autoTotalPoints: "Automatic total",
        sumSubQuestions: "sum of sub-questions",
        questionPoints: "Question points",
        sumQuestions: "sum of questions",
        
        // Notes
        gradesEntry: "Grade Entry",
        selectClass: "-- Select a class --",
        selectAssignment: "-- Select an assignment --",
        selectStudent: "-- Select a student --",
        selectClassFirst: "-- Select a class first --",
        selectAssignmentAndStudentToGrade: "Select an assignment and a student to enter grades.",
        globalGrade: "Global grade (overrides total):",
        ignoresDetails: "If filled, ignores the details below.",
        grade: "Grade:",
        
        // Récapitulatif
        summaryTitle: "Grades Summary",
        search: "Search (name, first name, class)",
        showDetails: "Show details (exercises)",
        noData: "Add students and assignments to see the summary.",
        noClassData: "No students or assignments for class",
        noResults: "No results match your search.",
        noStudentOrAssignmentForClass: "No students or assignments for class",
        noResultForSearch: "No results match your search.",
        addStudentsAndAssignmentsToSeeSummary: "Add students and assignments to see the summary.",
        
        // Messages d'erreur
        enterName: "Please enter at least a last name or first name",
        enterAssignmentName: "Please enter a name for the assignment",
        selectAssignmentClass: "Please select a class for this assignment",
        addExerciseFirst: "Add at least one exercise",
        deleteClassConfirm: "Delete class",
        andStudents: "and its",
        
        noClassesAutoCreated: "No classes. Classes are automatically created when adding students.",
        exerciseAbbr: "ex.",
        selectClassToStart: "Select a class to start",
        globalGrade: "Global grade (overrides total):",
        ignoresDetails: "If filled, ignores the details below.",
        total: "Total",
        grade: "Grade:",

        // Import
        importCompleted: "Import completed. New students added:",
        emptyFile: "Empty file or no data.",
        
        // Import
        importCompleted: "Import completed. New students added:",
        
        // Import
        importCompleted: "Import completed. New students added:"
    },
    
    ar: {
        // Interface générale
        appTitle: "📝 إدارة التصحيح",
        appSubtitle: "إدارة طلابك، واجباتك ودرجاتك بكل سهولة",
        
        // Navigation
        studentsTab: "👥 الطلاب",
        assignmentsTab: "📋 الواجبات",
        gradesTab: "🎯 الدرجات",
        summaryTab: "📊 الملخص",
        
        // Étudiants
        studentsList: "قائمة الطلاب",
        addStudent: "+ إضافة طالب",
        importExcel: "استيراد (.xlsx)",
        classManagement: "إدارة الفصول",
        noStudents: "لا يوجد طلاب. أضف طالبك الأول!",
        deleteStudent: "حذف هذا الطالب وجميع درجاته؟",
        student: "الطالب",
        students: "طالب",
        
        // Modal étudiant
        addStudentTitle: "إضافة طالب",
        lastName: "اللقب",
        firstName: "الاسم",
        className: "الفصل",
        nin: "الرقم الوطني (اختياري)",
        cancel: "إلغاء",
        add: "إضافة",
        
        // Devoirs
        assignmentsManagement: "إدارة الواجبات",
        createAssignment: "+ إنشاء واجب",
        filterByClass: "تصفية حسب الفصل",
        allClasses: "-- جميع الفصول --",
        filterByName: "تصفية حسب اسم الواجب",
        searchAssignment: "بحث عن واجب...",
        noAssignments: "لا توجد واجبات. أنشئ واجبك الأول!",
        noFilteredAssignments: "لا توجد واجبات تطابق عوامل التصفية المطبقة.",
        editAssignment: "تعديل الواجب",
        createAssignmentTitle: "إنشاء واجب",
        assignmentName: "اسم الواجب (مثال: واجب 1)",
        selectClass: "-- اختر فصلا --",
        addExercise: "+ إضافة تمرين",
        save: "حفظ",
        deleteAssignment: "حذف هذا الواجب وجميع الدرجات المرتبطة به؟",
        duplicate: "نسخ",
        edit: "تعديل",
        delete: "حذف",
        
        // Exercices et questions
        exercise: "تمرين",
        part: "جزء",
        totalPoints: "المجموع:",
        automaticTotal: "المجموع التلقائي",
        addPart: "+ إضافة جزء",
        addQuestion: "+ سؤال",
        addSubQuestions: "+أ،ب،ج",
        deleteExercise: "حذف هذا التمرين؟",
        deletePart: "حذف هذا الجزء؟",
        points: "نقطة",
        exerciseName: "الاسم (اختياري)",
        noExercises: "لا توجد تمارين",
        clickAddExercise: "انقر على '+ إضافة تمرين' للبدء.",
        noQuestions: "تمرين بدون أسئلة",
        directPointsOnly: "درجة مباشرة فقط",
        autoTotalPoints: "المجموع التلقائي",
        sumSubQuestions: "مجموع الأسئلة الفرعية",
        questionPoints: "نقاط السؤال",
        sumQuestions: "مجموع الأسئلة",
        
        // Notes
        gradesEntry: "إدخال الدرجات",
        selectClass: "-- اختر فصلا --",
        selectAssignment: "-- اختر واجبا --",
        selectStudent: "-- اختر طالبا --",
        selectClassFirst: "-- اختر فصلا أولا --",
        selectAssignmentAndStudentToGrade: "اختر واجبا وطالبا لإدخال الدرجات.",
        globalGrade: "الدرجة العامة (تتجاوز المجموع):",
        ignoresDetails: "إذا تم ملؤه، يتجاهل التفاصيل أدناه.",
        grade: "الدرجة:",
        
        // Récapitulatif
        summaryTitle: "ملخص الدرجات",
        search: "بحث (الاسم، الاسم الأول، الفصل)",
        showDetails: "إظهار التفاصيل (التمارين)",
        noData: "أضف طلابا وواجبات لرؤية الملخص.",
        noClassData: "لا توجد طلاب أو واجبات للفصل",
        noResults: "لا توجد نتائج تطابق بحثك.",
        noStudentOrAssignmentForClass: "لا توجد طلاب أو واجبات للفصل",
        noResultForSearch: "لا توجد نتائج تطابق بحثك.",
        addStudentsAndAssignmentsToSeeSummary: "أضف طلابا وواجبات لرؤية الملخص.",
        
        // Messages d'erreur
        enterName: "الرجاء إدخال اسم العائلة أو الاسم الأول على الأقل",
        enterAssignmentName: "الرجاء إدخال اسم للواجب",
        selectAssignmentClass: "الرجاء اختيار فصل لهذا الواجب",
        addExerciseFirst: "أضف تمرينا واحدا على الأقل",
        deleteClassConfirm: "حذف الفصل",
        andStudents: "وطالبه البالغ عددهم",
        
        noClassesAutoCreated: "لا توجد فصول. يتم إنشاء الفصول تلقائيًا عند إضافة الطلاب.",
        exerciseAbbr: "تمرين",
        selectClassToStart: "اختر فصلاً للبدء",
        globalGrade: "الدرجة العامة (تتجاوز المجموع):",
        ignoresDetails: "إذا تم ملؤه، يتجاهل التفاصيل أدناه.",
        total: "المجموع",
        grade: "الدرجة:",
        
        // Import
        importCompleted: "تم الاستيراد. طلاب جدد مضافون:",
        emptyFile: "ملف فارغ أو بدون بيانات."
    }
};