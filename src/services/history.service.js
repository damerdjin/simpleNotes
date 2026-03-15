/**
 * History Service to handle Undo functionality for grade entry.
 * It keeps a stack of snapshots of the grades object.
 */
export const historyService = {
    stack: [],
    maxSize: 50, // Permet d'annuler jusqu'à 50 modifications

    /**
     * Pushes a state snapshot onto the history stack.
     * @param {Object} state - The grades object state for a specific student/assignment.
     */
    pushState(studentId, assignmentId, state) {
        // Deep copy to ensure history doesn't point to current object
        const snapshot = JSON.parse(JSON.stringify(state));
        
        // On évite de dupliquer si le dernier état est identique
        const last = this.stack[this.stack.length - 1];
        if (last && last.studentId === studentId && last.assignmentId === assignmentId && 
            JSON.stringify(last.state) === JSON.stringify(snapshot)) {
            return;
        }

        this.stack.push({
            studentId,
            assignmentId,
            state: snapshot,
            timestamp: Date.now()
        });

        if (this.stack.length > this.maxSize) {
            this.stack.shift(); // Remove oldest
        }

        // --- Persistance Supabase (Optionnel) ---
        // On ne sauvegarde sur Supabase que si l'utilisateur est connecté
        if (window.store && typeof window.store.saveHistory === 'function') {
            window.store.saveHistory(studentId, assignmentId, snapshot);
        }
    },

    /**
     * Pops the last state for a specific student/assignment.
     * @param {string} studentId 
     * @param {string} assignmentId 
     * @returns {Object|null} The previous state or null if no history.
     */
    popState(studentId, assignmentId) {
        // Find the last entry for this specific student and assignment
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const entry = this.stack[i];
            if (entry.studentId === studentId && entry.assignmentId === assignmentId) {
                // Remove from stack and return
                this.stack.splice(i, 1);
                
                // Return the state BEFORE this one, or just the one we found?
                // Logic: Usually we want the state *before* the current one.
                // But the stack stores snapshots of states *before* they were changed.
                return entry.state;
            }
        }
        return null;
    },

    /**
     * Checks if there's history for a specific context.
     */
    hasHistory(studentId, assignmentId) {
        return this.stack.some(e => e.studentId === studentId && e.assignmentId === assignmentId);
    },

    clear() {
        this.stack = [];
    }
};

// Global export for vanilla JS access
if (typeof window !== 'undefined') {
    window.historyService = historyService;
}
