import { supabase } from '../ui/supabase-client.js';

export const settingsAdapter = {
    async loadSettings() {
        const userId = window.currentUser?.id;
        if (!userId) return null;

        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) {
                // Si pas de settings, ce n'est pas grave, on garde le local
                if (error.code !== 'PGRST116') console.warn('Load settings error:', error);
                return null;
            }
            return data;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async saveSettings(settings) {
        const userId = window.currentUser?.id;
        if (!userId) return;

        try {
            // On ne sauvegarde que ce qui est défini
            const payload = { user_id: userId, updated_at: new Date().toISOString() };
            if (settings.language) payload.language = settings.language;
            if (settings.current_academic_year) payload.current_academic_year = settings.current_academic_year;
            if (settings.current_trimester) payload.current_trimester = settings.current_trimester;

            const { error } = await supabase
                .from('user_settings')
                .upsert(payload, { onConflict: 'user_id' });
            
            if (error) console.error('Save settings error:', error);
        } catch (e) {
            console.error(e);
        }
    },

    // Méthode utilitaire pour synchroniser au login
    async sync() {
        const remote = await this.loadSettings();
        if (remote) {
            // Mise à jour du local storage si distant plus récent ou différent
            // On priorise le distant pour la continuité
            if (remote.language) localStorage.setItem('corrections-language', remote.language);
            if (remote.current_academic_year) localStorage.setItem('corrections-global-academic-year', remote.current_academic_year);
            if (remote.current_trimester) localStorage.setItem('corrections-global-trimester', remote.current_trimester);
            
            // Recharger la langue si elle a changé
            if (window.initLanguage && remote.language !== window.currentLanguage) {
                window.initLanguage();
            }
            
            // Rafraîchir l'UI globale
            if (window.syncGlobalUI) window.syncGlobalUI();
            
            // Si l'année a changé, recharger les données peut être nécessaire si le loadData dépend de l'année stockée
            // Mais loadData utilise souvent l'année courante calculée ou stockée.
            // On force un rechargement des données si l'année active a changé
            const currentYearInMem = window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : null;
            if (remote.current_academic_year && currentYearInMem !== remote.current_academic_year) {
                 if (window.loadData) window.loadData();
            }
        }
    }
};
