import { useAuth } from '../context/AuthContext'

export const DEFAULT_PREFS = {
  watching: true, activity: true, releases: true,
  stat_status: true, stat_year: false, stat_hours: false, stat_episodes: false, stat_monthly: false,
}

export const PREF_LABELS = [
  ['watching', 'Últimos assistidos'],
  ['activity', 'Atividade recente'],
  ['releases', 'Novidades no mundo'],
  ['stat_status', 'Contadores por status'],
  ['stat_year', 'Finalizados no ano'],
  ['stat_hours', 'Horas assistidas'],
  ['stat_episodes', 'Episódios assistidos'],
  ['stat_monthly', 'Gráfico de finalizados por mês'],
]

export function usePrefs() {
  const { profile } = useAuth()
  return { ...DEFAULT_PREFS, ...(profile?.home_prefs ?? {}) }
}
